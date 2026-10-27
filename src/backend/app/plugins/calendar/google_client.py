import os
from typing import Any
from urllib.parse import quote, urlencode

import aiohttp


class GoogleCalendarNotConfigured(RuntimeError):
    pass


class GoogleCalendarClient:
    """Small async Google Calendar API client kept behind the plugin boundary."""

    authorization_endpoint = "https://accounts.google.com/o/oauth2/v2/auth"
    token_endpoint = "https://oauth2.googleapis.com/token"
    api_endpoint = "https://www.googleapis.com/calendar/v3"

    def __init__(self):
        self.client_id = os.getenv("GOOGLE_CALENDAR_CLIENT_ID", "").strip() or None
        self.client_secret = os.getenv("GOOGLE_CALENDAR_CLIENT_SECRET", "").strip() or None
        self.redirect_uri = os.getenv("GOOGLE_CALENDAR_REDIRECT_URI", "").strip() or None

    @property
    def configured(self) -> bool:
        return bool(self.client_id and self.client_secret and self.redirect_uri)

    def authorization_url(self, state: str) -> str:
        if not self.configured:
            raise GoogleCalendarNotConfigured("Google Calendar OAuth is not configured")
        query = urlencode({
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": "https://www.googleapis.com/auth/calendar",
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        })
        return f"{self.authorization_endpoint}?{query}"

    async def exchange_code(self, code: str) -> dict[str, Any]:
        if not self.configured:
            raise GoogleCalendarNotConfigured("Google Calendar OAuth is not configured")
        payload = {"code": code, "client_id": self.client_id, "client_secret": self.client_secret, "redirect_uri": self.redirect_uri, "grant_type": "authorization_code"}
        async with aiohttp.ClientSession() as session:
            async with session.post(self.token_endpoint, data=payload, timeout=20) as response:
                data = await response.json()
                if response.status >= 400:
                    raise RuntimeError(data.get("error_description", "Google OAuth exchange failed"))
                return data

    async def refresh_access_token(self, refresh_token: str) -> dict[str, Any]:
        if not self.configured:
            raise GoogleCalendarNotConfigured("Google Calendar OAuth is not configured")
        payload = {"client_id": self.client_id, "client_secret": self.client_secret, "refresh_token": refresh_token, "grant_type": "refresh_token"}
        async with aiohttp.ClientSession() as session:
            async with session.post(self.token_endpoint, data=payload, timeout=20) as response:
                data = await response.json()
                if response.status >= 400:
                    raise RuntimeError(data.get("error_description", "Google token refresh failed"))
                return data

    async def request(self, access_token: str, method: str, path: str, **kwargs) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {access_token}", **kwargs.pop("headers", {})}
        async with aiohttp.ClientSession() as session:
            async with session.request(method, f"{self.api_endpoint}{path}", headers=headers, timeout=20, **kwargs) as response:
                data = await response.json() if response.content_type == "application/json" else {}
                if response.status >= 400:
                    raise RuntimeError(data.get("error", {}).get("message", "Google Calendar request failed"))
                return data

    async def list_calendars(self, access_token: str) -> dict[str, Any]:
        items: list[dict[str, Any]] = []
        page_token: str | None = None
        while True:
            params = {"showDeleted": "true", "showHidden": "true"}
            if page_token:
                params["pageToken"] = page_token
            page = await self.request(access_token, "GET", "/users/me/calendarList", params=params)
            items.extend(page.get("items", []))
            page_token = page.get("nextPageToken")
            if not page_token:
                return {"items": items}

    async def list_events(self, access_token: str, calendar_id: str, **params) -> dict[str, Any]:
        items: list[dict[str, Any]] = []
        page_token: str | None = None
        while True:
            request_params = {"singleEvents": "true", "showDeleted": "true", **params}
            if page_token:
                request_params["pageToken"] = page_token
            encoded_calendar_id = quote(calendar_id, safe="")
            page = await self.request(access_token, "GET", f"/calendars/{encoded_calendar_id}/events", params=request_params)
            items.extend(page.get("items", []))
            page_token = page.get("nextPageToken")
            if not page_token:
                return {"items": items}

    async def create_event(self, access_token: str, calendar_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.request(access_token, "POST", f"/calendars/{quote(calendar_id, safe='')}/events", json=payload)

    async def update_event(self, access_token: str, calendar_id: str, event_id: str, payload: dict[str, Any], etag: str | None = None) -> dict[str, Any]:
        headers = {"If-Match": etag} if etag else {}
        return await self.request(access_token, "PUT", f"/calendars/{quote(calendar_id, safe='')}/events/{quote(event_id, safe='')}", json=payload, headers=headers)

    async def delete_event(self, access_token: str, calendar_id: str, event_id: str, etag: str | None = None) -> None:
        headers = {"If-Match": etag} if etag else {}
        await self.request(access_token, "DELETE", f"/calendars/{quote(calendar_id, safe='')}/events/{quote(event_id, safe='')}", headers=headers)