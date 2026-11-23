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
        "user-read-currently-playing user-read-playback-state user-read-recently-played user-modify-playback-state user-library-read playlist-read-private playlist-read-collaborative"
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

    async def playlists(self) -> list[dict[str, Any]]:
        playlists = []
        offset = 0
        while True:
            page = await self.request("GET", "/me/playlists", params={"limit": 50, "offset": offset})
            playlists.extend(page.get("items", []))
            if not page.get("next"):
                return playlists
            offset += len(page.get("items", []))

    async def recently_played_playlist_ids(self) -> list[str]:
        payload = await self.request("GET", "/me/player/recently-played", params={"limit": 50})
        playlist_ids = []
        for item in payload.get("items", []):
            context_uri = (item.get("context") or {}).get("uri", "")
            if context_uri.startswith("spotify:playlist:"):
                playlist_id = context_uri.rsplit(":", 1)[-1]
                if playlist_id and playlist_id not in playlist_ids:
                    playlist_ids.append(playlist_id)
        return playlist_ids

    async def search(self, query: str) -> dict[str, list[dict[str, Any]]]:
        payload = await self.request(
            "GET",
            "/search",
            params={"q": query, "type": "track,album,playlist,artist", "limit": 8},
        )
        return {
            "tracks": payload.get("tracks", {}).get("items", []),
            "albums": payload.get("albums", {}).get("items", []),
            "playlists": payload.get("playlists", {}).get("items", []),
            "artists": payload.get("artists", {}).get("items", []),
        }

    async def queue(self) -> list[dict[str, Any]]:
        payload = await self.request("GET", "/me/player/queue")
        return payload.get("queue", [])

    async def artist(self, artist_id: str) -> dict[str, Any]:
        return await self.request("GET", f"/artists/{artist_id}")

    async def devices(self) -> list[dict[str, Any]]:
        payload = await self.request("GET", "/me/player/devices")
        devices = payload.get("devices", [])
        return [
            {
                "id": device.get("id"),
                "name": device.get("name"),
                "type": device.get("type"),
                "is_active": bool(device.get("is_active")),
                "is_restricted": bool(device.get("is_restricted")),
                "volume_percent": device.get("volume_percent"),
            }
            for device in devices
            if device.get("id")
        ]

    async def transfer_playback(self, device_id: str, play: bool = True) -> None:
        await self.request("PUT", "/me/player", json={"device_ids": [device_id], "play": play})

    async def preferred_phone_device(self) -> dict[str, Any] | None:
        devices = await self.devices()
        for device in devices:
            if str(device.get("type", "")).lower() in {"smartphone", "phone"}:
                return device
        for device in devices:
            if device["is_active"]:
                return device
        return devices[0] if devices else None

    async def play_album(self, album_id: str, device_id: str | None = None) -> None:
        devices = await self.devices()
        target = next((device for device in devices if device["id"] == device_id), None) if device_id else None
        if not target:
            target = await self.preferred_phone_device()
        params = {"device_id": target["id"]} if target else None
        await self.request(
            "PUT",
            "/me/player/play",
            params=params,
            json={"context_uri": f"spotify:album:{album_id}"},
        )

    async def play_playlist(self, playlist_id: str, device_id: str | None = None) -> None:
        target = None
        if device_id:
            devices = await self.devices()
            target = next((device for device in devices if device["id"] == device_id), None)
        if not target:
            target = await self.preferred_phone_device()
        params = {"device_id": target["id"]} if target else None
        await self.request("PUT", "/me/player/play", params=params, json={"context_uri": f"spotify:playlist:{playlist_id}"})

    async def album(self, album_id: str) -> dict[str, Any]:
        payload = await self.request("GET", f"/albums/{album_id}")
        genres = set()
        for artist in payload.get("artists", []):
            artist_id = artist.get("id")
            if artist_id:
                try:
                    genres.update((await self.artist(artist_id)).get("genres", []))
                except ValueError:
                    pass
        return {
            "id": payload.get("id"),
            "name": payload.get("name", "Unknown album"),
            "artist": ", ".join(artist.get("name", "") for artist in payload.get("artists", [])),
            "release_date": payload.get("release_date"),
            "label": payload.get("label"),
            "popularity": payload.get("popularity", 0),
            "genres": sorted(genres),
            "tracks": [
                {
                    "id": track.get("id"),
                    "name": track.get("name"),
                    "duration_ms": track.get("duration_ms", 0),
                    "track_number": track.get("track_number"),
                    "explicit": bool(track.get("explicit")),
                }
                for track in payload.get("tracks", {}).get("items", [])
            ],
            "cover_image": (payload.get("images") or [{}])[0].get("url"),
        }

    async def playlist(self, playlist_id: str) -> dict[str, Any]:
        payload = await self.request("GET", f"/playlists/{playlist_id}")
        owner = payload.get("owner") or {}
        return {
            "id": payload.get("id"),
            "name": payload.get("name", "Untitled playlist"),
            "artist": owner.get("display_name") or owner.get("id", ""),
            "cover_image": (payload.get("images") or [{}])[0].get("url"),
            "description": payload.get("description"),
            "tracks": [
                {
                    "id": (item.get("track") or {}).get("id"),
                    "name": (item.get("track") or {}).get("name", "Unknown track"),
                    "duration_ms": (item.get("track") or {}).get("duration_ms", 0),
                    "artist": ", ".join(
                        artist.get("name", "")
                        for artist in (item.get("track") or {}).get("artists", [])
                    ),
                    "album": ((item.get("track") or {}).get("album") or {}).get("name", ""),
                }
                for item in (payload.get("tracks") or {}).get("items", [])
                if isinstance(item, dict) and isinstance(item.get("track"), dict) and (item.get("track") or {}).get("id")
            ],
        }

    async def play_track(self, track_id: str, device_id: str | None = None) -> None:
        target = None
        if device_id:
            devices = await self.devices()
            target = next((device for device in devices if device["id"] == device_id), None)
        if not target:
            target = await self.preferred_phone_device()
        params = {"device_id": target["id"]} if target else None
        await self.request("PUT", "/me/player/play", params=params, json={"uris": [f"spotify:track:{track_id}"]})

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

    async def seek(self, position_ms: int) -> None:
        await self.request("PUT", "/me/player/seek", params={"position_ms": max(0, position_ms)})

    async def set_volume(self, volume_percent: int) -> None:
        await self.request("PUT", "/me/player/volume", params={"volume_percent": max(0, min(100, volume_percent))})

    async def set_shuffle(self, state: bool) -> None:
        await self.request("PUT", "/me/player/shuffle", params={"state": str(state).lower()})

    async def set_repeat(self, state: str) -> None:
        if state not in {"off", "track", "context"}:
            raise ValueError("Repeat must be off, track, or context")
        await self.request("PUT", "/me/player/repeat", params={"state": state})