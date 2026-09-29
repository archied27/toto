"""Backend-owned TMDB catalog, agent availability, progress, and playback state."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.db.manager import DBManager


class MediaDb:
    def __init__(self, db: DBManager):
        self.db = db

    async def initialise(self) -> None:
        await self.db.execute(
            """CREATE TABLE IF NOT EXISTS media_items (
                media_type TEXT NOT NULL,
                tmdb_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                metadata_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (media_type, tmdb_id)
            )"""
        )
        await self.db.execute(
            """CREATE TABLE IF NOT EXISTS media_sources (
                agent_id TEXT NOT NULL,
                media_type TEXT NOT NULL,
                tmdb_id INTEGER NOT NULL,
                season_number INTEGER,
                episode_number INTEGER,
                duration_seconds INTEGER,
                available INTEGER NOT NULL DEFAULT 1,
                last_seen TEXT NOT NULL,
                PRIMARY KEY (agent_id, media_type, tmdb_id, season_number, episode_number)
            )"""
        )
        await self.db.execute(
            """CREATE TABLE IF NOT EXISTS media_progress (
                agent_id TEXT NOT NULL,
                media_type TEXT NOT NULL,
                tmdb_id INTEGER NOT NULL,
                season_number INTEGER,
                episode_number INTEGER,
                position_seconds REAL NOT NULL DEFAULT 0,
                duration_seconds REAL,
                completed INTEGER NOT NULL DEFAULT 0,
                last_watched TEXT,
                PRIMARY KEY (agent_id, media_type, tmdb_id, season_number, episode_number)
            )"""
        )
        await self.db.execute(
            """CREATE TABLE IF NOT EXISTS media_playback_sessions (
                agent_id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                media_type TEXT,
                tmdb_id INTEGER,
                season_number INTEGER,
                episode_number INTEGER,
                position_seconds REAL,
                duration_seconds REAL,
                updated_at TEXT NOT NULL
            )"""
        )

    async def upsert_item(self, media_type: str, tmdb_id: int, details: dict[str, Any]) -> None:
        import json
        await self.db.execute(
            """INSERT INTO media_items(media_type, tmdb_id, title, metadata_json, updated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(media_type, tmdb_id) DO UPDATE SET title=excluded.title,
               metadata_json=excluded.metadata_json, updated_at=excluded.updated_at""",
            [media_type, tmdb_id, details.get("title", "Unknown"), json.dumps(details), self._now()],
        )

    async def upsert_source(self, agent_id: str, source: dict[str, Any]) -> None:
        await self.db.execute(
            """INSERT INTO media_sources(agent_id, media_type, tmdb_id, season_number, episode_number,
               duration_seconds, available, last_seen)
               VALUES (?, ?, ?, ?, ?, ?, 1, ?)
               ON CONFLICT(agent_id, media_type, tmdb_id, season_number, episode_number)
               DO UPDATE SET duration_seconds=excluded.duration_seconds, available=1,
               last_seen=excluded.last_seen""",
            [agent_id, source["media_type"], source["tmdb_id"], source.get("season_number"),
             source.get("episode_number"), source.get("duration_seconds"), self._now()],
        )

    async def mark_agent_unavailable(self, agent_id: str) -> None:
        await self.db.execute(
            "UPDATE media_sources SET available = 0, last_seen = ? WHERE agent_id = ?",
            [self._now(), agent_id],
        )

    async def get_item(self, media_type: str, tmdb_id: int) -> dict[str, Any] | None:
        import json
        item = await self.db.fetch_one(
            "SELECT metadata_json FROM media_items WHERE media_type = ? AND tmdb_id = ?",
            [media_type, tmdb_id],
        )
        if item is None:
            return None
        sources = await self.db.fetch_all(
            """SELECT agent_id, season_number, episode_number, duration_seconds, available
               FROM media_sources WHERE media_type = ? AND tmdb_id = ? AND available = 1""",
            [media_type, tmdb_id],
        )
        result = json.loads(item["metadata_json"])
        result["tmdb_id"] = tmdb_id
        result["media_type"] = media_type
        result["available_on"] = [dict(source) for source in sources]
        return result

    async def get_playing(self, agent_id: str | None = None) -> list[dict[str, Any]]:
        query = "SELECT * FROM media_playback_sessions"
        params: list[Any] = []
        if agent_id:
            query += " WHERE agent_id = ?"
            params.append(agent_id)
        return [dict(row) for row in await self.db.fetch_all(query, params)]

    async def save_state(self, agent_id: str, state: dict[str, Any]) -> None:
        now = state.get("updated_at") or self._now()
        await self.db.execute(
            """INSERT INTO media_playback_sessions(agent_id, status, media_type, tmdb_id,
               season_number, episode_number, position_seconds, duration_seconds, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(agent_id) DO UPDATE SET status=excluded.status,
               media_type=excluded.media_type, tmdb_id=excluded.tmdb_id,
               season_number=excluded.season_number, episode_number=excluded.episode_number,
               position_seconds=excluded.position_seconds, duration_seconds=excluded.duration_seconds,
               updated_at=excluded.updated_at""",
            [agent_id, state.get("status", "stopped"), state.get("media_type"), state.get("tmdb_id"),
             state.get("season_number"), state.get("episode_number"), state.get("position_seconds"),
             state.get("duration_seconds"), now],
        )
        if state.get("tmdb_id") is not None:
            await self.db.execute(
                """INSERT INTO media_progress(agent_id, media_type, tmdb_id, season_number, episode_number,
                   position_seconds, duration_seconds, completed, last_watched)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(agent_id, media_type, tmdb_id, season_number, episode_number)
                   DO UPDATE SET position_seconds=excluded.position_seconds,
                   duration_seconds=excluded.duration_seconds, completed=excluded.completed,
                   last_watched=excluded.last_watched""",
                [agent_id, state.get("media_type"), state["tmdb_id"], state.get("season_number"),
                 state.get("episode_number"), state.get("position_seconds", 0), state.get("duration_seconds"),
                 int(state.get("status") == "completed" or (
                     state.get("duration_seconds") and state.get("position_seconds", 0) >= state["duration_seconds"] * 0.9
                 )), now],
            )

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()
