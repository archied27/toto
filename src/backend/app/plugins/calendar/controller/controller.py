from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.core.core import Core
from app.plugins.calendar.google_client import GoogleCalendarClient
from app.plugins.calendar.schemas import CalendarEvent, CalendarSource, CalendarState, CalendarVisibility, CreateEvent, UpdateEvent


class CalendarController:
    def __init__(self, core: Core):
        self.core = core
        self.db = core.db_manager
        self.google = GoogleCalendarClient()
        self.oauth_state: str | None = None

    async def setup(self):
        await self.db.execute_many("""
            CREATE TABLE IF NOT EXISTS calendar_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                google_id TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                colour TEXT NOT NULL DEFAULT '#5b8def',
                timezone TEXT NOT NULL DEFAULT 'Europe/London',
                can_write INTEGER NOT NULL DEFAULT 0,
                is_default INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS calendar_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_id INTEGER NOT NULL,
                google_id TEXT,
                etag TEXT,
                title TEXT NOT NULL,
                description TEXT,
                location TEXT,
                meeting_url TEXT,
                start TEXT NOT NULL,
                end TEXT NOT NULL,
                all_day INTEGER NOT NULL DEFAULT 0,
                timezone TEXT NOT NULL DEFAULT 'Europe/London',
                deleted INTEGER NOT NULL DEFAULT 0,
                UNIQUE(source_id, google_id),
                FOREIGN KEY(source_id) REFERENCES calendar_sources(id)
            );
            CREATE TABLE IF NOT EXISTS calendar_sync_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                status TEXT NOT NULL DEFAULT 'not_configured',
                last_synced_at TEXT,
                next_sync_token TEXT,
                last_error TEXT
            );
            CREATE TABLE IF NOT EXISTS calendar_account (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                access_token TEXT,
                refresh_token TEXT,
                expires_at TEXT
            );
            CREATE TABLE IF NOT EXISTS calendar_visibility (
                source_id INTEGER PRIMARY KEY,
                visible INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY(source_id) REFERENCES calendar_sources(id)
            );
            INSERT OR IGNORE INTO calendar_sync_state (id) VALUES (1);
        """)
        await self.update_state()
        self.core.bus.on("calendar.sync", self.sync)
        self.core.scheduler.add_recurring("calendar.sync", hour="*/5")

    async def complete_oauth(self, code: str):
        token = await self.google.exchange_code(code)
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=int(token.get("expires_in", 3600)))).isoformat()
        current = await self.db.fetch_one("SELECT refresh_token FROM calendar_account WHERE id = 1")
        refresh_token = token.get("refresh_token") or (current["refresh_token"] if current else None)
        await self.db.execute("INSERT OR REPLACE INTO calendar_account (id, access_token, refresh_token, expires_at) VALUES (1, ?, ?, ?)", [token.get("access_token"), refresh_token, expires_at])
        await self.sync()

    async def _access_token(self) -> str:
        account = await self.db.fetch_one("SELECT * FROM calendar_account WHERE id = 1")
        if account is None or not account["access_token"]:
            raise ValueError("Google Calendar is not connected")
        expires_at = datetime.fromisoformat(account["expires_at"]) if account["expires_at"] else datetime.min.replace(tzinfo=timezone.utc)
        if expires_at > datetime.now(timezone.utc) + timedelta(seconds=30):
            return account["access_token"]
        if not account["refresh_token"]:
            raise ValueError("Google Calendar refresh token is missing")
        token = await self.google.refresh_access_token(account["refresh_token"])
        new_expires_at = (datetime.now(timezone.utc) + timedelta(seconds=int(token.get("expires_in", 3600)))).isoformat()
        await self.db.execute("UPDATE calendar_account SET access_token = ?, expires_at = ? WHERE id = 1", [token["access_token"], new_expires_at])
        return token["access_token"]

    @staticmethod
    def _google_datetime(value: dict, all_day: bool) -> tuple[datetime, str]:
        if all_day:
            return datetime.fromisoformat(value["date"]).replace(tzinfo=ZoneInfo("Europe/London")), "Europe/London"
        raw = value["dateTime"].replace("Z", "+00:00")
        return datetime.fromisoformat(raw), value.get("timeZone", "Europe/London")

    async def sync(self):
        sync_errors: list[str] = []
        try:
            access_token = await self._access_token()
            calendars = await self.google.list_calendars(access_token)
            for calendar in calendars.get("items", []):
                try:
                    access_role = calendar.get("accessRole", "reader")
                    source_values = [calendar["id"], calendar.get("summary", calendar["id"]), calendar.get("backgroundColor", "#5b8def"), calendar.get("timeZone", "Europe/London"), int(access_role not in {"reader", "freeBusyReader"})]
                    await self.db.execute("INSERT INTO calendar_sources (google_id, name, colour, timezone, can_write, is_default) VALUES (?, ?, ?, ?, ?, 0) ON CONFLICT(google_id) DO UPDATE SET name = excluded.name, colour = excluded.colour, timezone = excluded.timezone, can_write = excluded.can_write", source_values)
                    source = await self.db.fetch_one("SELECT * FROM calendar_sources WHERE google_id = ?", [calendar["id"]])
                    start_window = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
                    end_window = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
                    events = await self.google.list_events(access_token, calendar["id"], timeMin=start_window, timeMax=end_window)
                    for item in events.get("items", []):
                        if "start" not in item or "end" not in item:
                            continue
                        all_day = "date" in item.get("start", {})
                        start, event_timezone = self._google_datetime(item["start"], all_day)
                        end, _ = self._google_datetime(item["end"], all_day)
                        conference = item.get("hangoutLink") or (item.get("conferenceData", {}).get("entryPoints", [{}])[0].get("uri"))
                        await self.db.execute("INSERT INTO calendar_events (source_id, google_id, etag, title, description, location, meeting_url, start, end, all_day, timezone, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source_id, google_id) DO UPDATE SET etag = excluded.etag, title = excluded.title, description = excluded.description, location = excluded.location, meeting_url = excluded.meeting_url, start = excluded.start, end = excluded.end, all_day = excluded.all_day, timezone = excluded.timezone, deleted = excluded.deleted", [source["id"], item["id"], item.get("etag"), item.get("summary", "Untitled event"), item.get("description"), item.get("location"), conference, start.isoformat(), end.isoformat(), int(all_day), event_timezone, int(item.get("status") == "cancelled")])
                except Exception as error:
                    sync_errors.append(f"{calendar.get('summary', calendar.get('id', 'Unknown calendar'))}: {error}")
            default = await self.db.fetch_one("SELECT id FROM calendar_sources WHERE can_write = 1 AND is_default = 1")
            if default is None:
                first_writable = await self.db.fetch_one("SELECT id FROM calendar_sources WHERE can_write = 1 ORDER BY id LIMIT 1")
                if first_writable:
                    await self.db.execute("UPDATE calendar_sources SET is_default = 1 WHERE id = ?", [first_writable["id"]])
            await self.db.execute("UPDATE calendar_sync_state SET status = ?, last_synced_at = ?, last_error = ? WHERE id = 1", ["error" if sync_errors else "synced", datetime.now(timezone.utc).isoformat(), "; ".join(sync_errors)[:1000] or None])
        except Exception as error:
            await self.db.execute("UPDATE calendar_sync_state SET status = 'error', last_error = ? WHERE id = 1", [str(error)])
        await self.update_state()

    @staticmethod
    def _event(row) -> CalendarEvent:
        return CalendarEvent(
            id=row["id"], source_id=row["source_id"], google_id=row["google_id"],
            etag=row["etag"], title=row["title"], description=row["description"],
            location=row["location"], meeting_url=row["meeting_url"],
            start=datetime.fromisoformat(row["start"]), end=datetime.fromisoformat(row["end"]),
            all_day=bool(row["all_day"]), timezone=row["timezone"], colour=row["colour"],
        )

    async def get_sources(self) -> list[CalendarSource]:
        rows = await self.db.fetch_all("SELECT * FROM calendar_sources ORDER BY name")
        return [CalendarSource(id=row["id"], google_id=row["google_id"], name=row["name"], colour=row["colour"], timezone=row["timezone"], can_write=bool(row["can_write"]), is_default=bool(row["is_default"])) for row in rows]

    async def get_visibility(self) -> CalendarVisibility:
        rows = await self.db.fetch_all("SELECT id FROM calendar_sources WHERE id NOT IN (SELECT source_id FROM calendar_visibility WHERE visible = 0)")
        return CalendarVisibility(visible_source_ids=[row["id"] for row in rows])

    async def set_visibility(self, visible_source_ids: list[int]) -> CalendarVisibility:
        sources = await self.db.fetch_all("SELECT id FROM calendar_sources")
        allowed = {row["id"] for row in sources}
        visible = set(visible_source_ids) & allowed
        for source_id in allowed:
            await self.db.execute("INSERT INTO calendar_visibility (source_id, visible) VALUES (?, ?) ON CONFLICT(source_id) DO UPDATE SET visible = excluded.visible", [source_id, int(source_id in visible)])
        result = await self.get_visibility()
        self.core.bus.emit_no_wait("calendar.state_updated", {"visibility_changed": True})
        return result

    async def get_events(self, start: datetime, end: datetime, source_ids: list[int] | None = None) -> list[CalendarEvent]:
        params: list = [end.isoformat(), start.isoformat()]
        source_clause = ""
        if source_ids:
            source_clause = f" AND e.source_id IN ({','.join('?' for _ in source_ids)})"
            params.extend(source_ids)
        rows = await self.db.fetch_all(
            "SELECT e.*, s.colour FROM calendar_events e JOIN calendar_sources s ON s.id = e.source_id "
            "WHERE e.deleted = 0 AND e.start < ? AND e.end > ?" + source_clause + " ORDER BY e.start",
            params,
        )
        return [self._event(row) for row in rows]

    async def create_event(self, event: CreateEvent) -> CalendarEvent:
        source = await self._write_source(event.source_id)
        google_id = None
        etag = None
        meeting_url = None
        if await self.db.fetch_one("SELECT id FROM calendar_account WHERE id = 1"):
            access_token = await self._access_token()
            payload = self._provider_payload(event.title, event.description, event.location, event.start, event.end, event.all_day, event.timezone)
            remote = await self.google.create_event(access_token, source.google_id, payload)
            google_id = remote.get("id")
            etag = remote.get("etag")
            meeting_url = remote.get("hangoutLink")
        event_id = await self.db.execute(
            "INSERT INTO calendar_events (source_id, google_id, etag, title, description, location, meeting_url, start, end, all_day, timezone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [source.id, google_id, etag, event.title, event.description, event.location, meeting_url, event.start.isoformat(), event.end.isoformat(), int(event.all_day), event.timezone],
        )
        await self.update_state()
        rows = await self.db.fetch_all("SELECT e.*, s.colour FROM calendar_events e JOIN calendar_sources s ON s.id = e.source_id WHERE e.id = ?", [event_id])
        return self._event(rows[0])

    async def update_event(self, event_id: int, changes: UpdateEvent) -> CalendarEvent:
        current = await self.db.fetch_one("SELECT * FROM calendar_events WHERE id = ?", [event_id])
        if current is None:
            raise ValueError("Calendar event not found")
        values = {key: value for key, value in changes.model_dump().items() if value is not None}
        source = await self.db.fetch_one("SELECT s.* FROM calendar_sources s JOIN calendar_events e ON e.source_id = s.id WHERE e.id = ?", [event_id])
        if current["google_id"] and source and await self.db.fetch_one("SELECT id FROM calendar_account WHERE id = 1"):
            access_token = await self._access_token()
            payload = self._provider_payload(values.get("title", current["title"]), values.get("description", current["description"]), values.get("location", current["location"]), values.get("start", datetime.fromisoformat(current["start"])), values.get("end", datetime.fromisoformat(current["end"])), values.get("all_day", bool(current["all_day"])), values.get("timezone", current["timezone"]))
            await self.google.update_event(access_token, source["google_id"], current["google_id"], payload, current["etag"])
        if values:
            columns = {"start": "start", "end": "end", "all_day": "all_day"}
            assignments = []
            params = []
            for key, value in values.items():
                assignments.append(f"{columns.get(key, key)} = ?")
                params.append(int(value) if key == "all_day" else value.isoformat() if isinstance(value, datetime) else value)
            params.append(event_id)
            await self.db.execute(f"UPDATE calendar_events SET {', '.join(assignments)} WHERE id = ?", params)
        await self.update_state()
        rows = await self.db.fetch_all("SELECT e.*, s.colour FROM calendar_events e JOIN calendar_sources s ON s.id = e.source_id WHERE e.id = ?", [event_id])
        return self._event(rows[0])

    async def delete_event(self, event_id: int):
        current = await self.db.fetch_one("SELECT e.*, s.google_id AS calendar_google_id FROM calendar_events e JOIN calendar_sources s ON s.id = e.source_id WHERE e.id = ?", [event_id])
        if current and current["google_id"] and await self.db.fetch_one("SELECT id FROM calendar_account WHERE id = 1"):
            access_token = await self._access_token()
            await self.google.delete_event(access_token, current["calendar_google_id"], current["google_id"], current["etag"])
        await self.db.execute("UPDATE calendar_events SET deleted = 1 WHERE id = ?", [event_id])
        await self.update_state()

    @staticmethod
    def _provider_payload(title, description, location, start, end, all_day, timezone_name):
        if all_day:
            start_value = {"date": start.date().isoformat()}
            end_value = {"date": end.date().isoformat()}
        else:
            start_value = {"dateTime": start.isoformat(), "timeZone": timezone_name}
            end_value = {"dateTime": end.isoformat(), "timeZone": timezone_name}
        return {"summary": title, "description": description, "location": location, "start": start_value, "end": end_value}

    async def _write_source(self, source_id: int | None) -> CalendarSource:
        if source_id is not None:
            row = await self.db.fetch_one("SELECT * FROM calendar_sources WHERE id = ?", [source_id])
        else:
            row = await self.db.fetch_one("SELECT * FROM calendar_sources WHERE is_default = 1")
        if row is None:
            raise ValueError("Connect Google Calendar and choose a default calendar first")
        return CalendarSource(id=row["id"], google_id=row["google_id"], name=row["name"], colour=row["colour"], timezone=row["timezone"], can_write=bool(row["can_write"]), is_default=bool(row["is_default"]))

    async def update_state(self):
        tz = ZoneInfo("Europe/London")
        now = datetime.now(tz)
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        rows = await self.db.fetch_all("SELECT e.*, s.colour FROM calendar_events e JOIN calendar_sources s ON s.id = e.source_id WHERE e.deleted = 0 AND e.start < ? AND e.end > ? ORDER BY e.start", [(today + timedelta(days=1)).isoformat(), today.isoformat()])
        status = await self.db.fetch_one("SELECT status, last_synced_at, last_error FROM calendar_sync_state WHERE id = 1")
        all_events = await self.get_events(now, now + timedelta(days=30))
        state = CalendarState(connected=bool(await self.db.fetch_one("SELECT id FROM calendar_sources LIMIT 1")), sync_status=status["status"], last_synced_at=datetime.fromisoformat(status["last_synced_at"]) if status["last_synced_at"] else None, last_error=status["last_error"], events_today=[self._event(row) for row in rows], next_event=all_events[0] if all_events else None, dashboard_priority=20 if rows else 0)
        old = self.core.state.get("calendar")
        if old != state:
            await self.core.state.set("calendar", state)
            self.core.bus.emit_no_wait("calendar.state_updated", state.model_dump(mode="json"))
            self.core.bus.emit_no_wait("dashboard.rerank")
            self.core.bus.emit_no_wait("pages.rerank")

    async def get_state(self) -> CalendarState:
        state = self.core.state.get("calendar")
        if state is None:
            await self.update_state()
            state = self.core.state.get("calendar")
        return state