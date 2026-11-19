import base64
import os
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import aiohttp


class SpotifyNotConfigured(Exception):
    pass


class SpotifyClient:
    authorization_scopes = (
        "user-read-currently-playing user-read-playback-state user-modify-playback-state user-library-read"
    )

    def __init__(self, db):
        self.db = db
        self.client_id = os.getenv("SPOTIFY_CLIENT_ID")
        self.client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
        self.redirect_uri = os.getenv("SPOTIFY_REDIRECT_URI", "http://localhost:8000/spotify/oauth/callback")

    def _require_configured(self):
        if not self.client_id or not self.client_secret:
            raise SpotifyNotConfigured("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first")

    def authorization_url(self, state: str) -> str:
        self._require_configured()
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "scope": self.authorization_scopes,
            "state": state,
        }
        return "https://accounts.spotify.com/authorize?" + urlencode(params)

    async def exchange_code(self, code: str) -> dict[str, Any]:
        self._require_configured()
        return await self._token_request({"grant_type": "authorization_code", "code": code, "redirect_uri": self.redirect_uri})

    async def _token_request(self, data: dict[str, str]) -> dict[str, Any]:
        credentials = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode()
        headers = {"Authorization": f"Basic {credentials}", "Content-Type": "application/x-www-form-urlencoded"}
        async with aiohttp.ClientSession() as session:
            async with session.post("https://accounts.spotify.com/api/token", data=data, headers=headers) as response:
                payload = await response.json()
                if response.status >= 400:
                    raise ValueError(payload.get("error_description", "Spotify token request failed"))
                return payload

    async def save_token(self, token: dict[str, Any]) -> None:
        current = await self.db.fetch_one("SELECT refresh_token FROM spotify_account WHERE id = 1")
        refresh_token = token.get("refresh_token") or (current["refresh_token"] if current else None)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(token.get("expires_in", 3600)))
        await self.db.execute(
            "INSERT OR REPLACE INTO spotify_account (id, access_token, refresh_token, expires_at) VALUES (1, ?, ?, ?)",
            [token.get("access_token"), refresh_token, expires_at.isoformat()],
        )

    async def _access_token(self) -> str:
        account = await self.db.fetch_one("SELECT * FROM spotify_account WHERE id = 1")
        if not account or not account["access_token"]:
            raise ValueError("Spotify is not connected")
        expires_at = datetime.fromisoformat(account["expires_at"]) if account["expires_at"] else datetime.min.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc) + timedelta(seconds=60):
            if not account["refresh_token"]:
                raise ValueError("Spotify refresh token is missing; reconnect Spotify")
            token = await self._token_request({"grant_type": "refresh_token", "refresh_token": account["refresh_token"]})
            await self.save_token(token)
            return token["access_token"]
        return account["access_token"]

    async def is_connected(self) -> bool:
        account = await self.db.fetch_one("SELECT access_token FROM spotify_account WHERE id = 1")
        return bool(account and account["access_token"])

    async def request(self, method: str, path: str, **kwargs: Any) -> Any:
        token = await self._access_token()
        headers = {"Authorization": f"Bearer {token}", **kwargs.pop("headers", {})}
        async with aiohttp.ClientSession() as session:
            async with session.request(method, f"https://api.spotify.com/v1{path}", headers=headers, **kwargs) as response:
                if response.status == 204:
                    return None
                payload = await response.json()
                if response.status >= 400:
                    raise ValueError(payload.get("error", {}).get("message", "Spotify request failed"))
                return payload

    async def current_playback(self) -> dict[str, Any] | None:
        return await self.request("GET", "/me/player")

    async def saved_albums(self) -> list[dict[str, Any]]:
        albums = []
        offset = 0
        while True:
            page = await self.request("GET", "/me/albums", params={"limit": 50, "offset": offset})
            albums.extend(item["album"] for item in page.get("items", []))
            if not page.get("next"):
                return albums
            offset += len(page.get("items", []))

    async def artist(self, artist_id: str) -> dict[str, Any]:
        return await self.request("GET", f"/artists/{artist_id}")

    async def play_album(self, album_id: str) -> None:
        await self.request("PUT", "/me/player/play", json={"context_uri": f"spotify:album:{album_id}"})

    async def control(self, action: str) -> None:
        methods = {
            "play": ("PUT", "/me/player/play"),
            "pause": ("PUT", "/me/player/pause"),
            "next": ("POST", "/me/player/next"),
            "previous": ("POST", "/me/player/previous"),
        }
        if action not in methods:
            raise ValueError(f"Unsupported Spotify action: {action}")
        method, path = methods[action]
        await self.request(method, path)