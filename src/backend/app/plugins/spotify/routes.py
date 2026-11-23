import secrets

import aiohttp
from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import RedirectResponse

from app.plugins.spotify.client import SpotifyClient, SpotifyNotConfigured


class SpotifyRouter:
    def __init__(self, client: SpotifyClient, plugin):
        self.client = client
        self.plugin = plugin
        self.router = APIRouter()
        self.router.add_api_route("/state", self.state, methods=["GET"])
        self.router.add_api_route("/connect", self.connect, methods=["GET"])
        self.router.add_api_route("/oauth/callback", self.oauth_callback, methods=["GET"])
        self.router.add_api_route("/playing", self.playing, methods=["GET"])
        self.router.add_api_route("/playlists", self.playlists, methods=["GET"])
        self.router.add_api_route("/search", self.search, methods=["GET"])
        self.router.add_api_route("/queue", self.queue, methods=["GET"])
        self.router.add_api_route("/devices", self.devices, methods=["GET"])
        self.router.add_api_route("/devices/{device_id}/transfer", self.transfer, methods=["POST"])
        self.router.add_api_route("/control/{action}", self.control, methods=["POST"])
        self.router.add_api_route("/seek", self.seek, methods=["POST"])
        self.router.add_api_route("/volume", self.volume, methods=["POST"])
        self.router.add_api_route("/shuffle", self.shuffle, methods=["POST"])
        self.router.add_api_route("/repeat", self.repeat, methods=["POST"])
        self.router.add_api_route("/albums/sync", self.sync_albums, methods=["POST"])
        self.router.add_api_route("/albums/recluster", self.recluster_albums, methods=["POST"])
        self.router.add_api_route("/clusters", self.clusters, methods=["GET"])
        self.router.add_api_route("/clusters/{cluster_id}/name", self.rename_cluster, methods=["PUT"])
        self.router.add_api_route("/clusters/{cluster_id}", self.cluster, methods=["GET"])
        self.router.add_api_route("/albums/by-tag/{tag}", self.albums_by_tag, methods=["GET"])
        self.router.add_api_route("/albums/{album_id}/tags", self.album_tags, methods=["GET"])
        self.router.add_api_route("/albums/{album_id}", self.album, methods=["GET"])
        self.router.add_api_route("/albums/{album_id}/play", self.play_album, methods=["POST"])
        self.router.add_api_route("/playlists/{playlist_id}", self.playlist, methods=["GET"])
        self.router.add_api_route("/playlists/{playlist_id}/play", self.play_playlist, methods=["POST"])
        self.router.add_api_route("/tracks/{track_id}/play", self.play_track, methods=["POST"])

    async def state(self):
        return self.plugin.state

    async def connect(self):
        try:
            state = secrets.token_urlsafe(24)
            self.plugin.oauth_state = state
            return {"authorization_url": self.client.authorization_url(state)}
        except SpotifyNotConfigured as error:
            raise HTTPException(status_code=503, detail=str(error)) from error

    async def oauth_callback(self, code: str, state: str):
        if state != self.plugin.oauth_state:
            raise HTTPException(status_code=400, detail="Invalid OAuth state")
        try:
            await self.client.save_token(await self.client.exchange_code(code))
            await self.plugin.refresh()
        except ValueError as error:
            raise HTTPException(status_code=502, detail=str(error)) from error
        return RedirectResponse(url="/spotify")

    async def playing(self):
        try:
            return await self.plugin.refresh()
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    async def devices(self):
        try:
            return await self.client.devices()
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    async def playlists(self):
        try:
            playlists = await self.client.playlists()
            try:
                recent_ids = await self.client.recently_played_playlist_ids()
            except ValueError:
                recent_ids = []
            recent_order = {playlist_id: index for index, playlist_id in enumerate(recent_ids)}
            results = [
                {
                    "id": playlist.get("id"),
                    "name": playlist.get("name", "Untitled playlist"),
                    "owner": (playlist.get("owner") or {}).get("display_name") or (playlist.get("owner") or {}).get("id"),
                    "count": playlist.get("tracks", {}).get("total", 0),
                    "cover_image": (playlist.get("images") or [{}])[0].get("url"),
                    "last_listened": recent_order.get(playlist.get("id")),
                }
                for playlist in playlists
                if isinstance(playlist, dict) and playlist.get("id")
            ]
            return sorted(results, key=lambda playlist: recent_order.get(playlist["id"], len(recent_order)))
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    async def search(self, q: str):
        if not q.strip():
            return {"tracks": [], "albums": [], "playlists": [], "artists": []}
        try:
            payload = await self.client.search(q.strip())
            tracks = self._valid_items(payload.get("tracks"))
            albums = self._valid_items(payload.get("albums"))
            playlists = self._valid_items(payload.get("playlists"))
            artists = self._valid_items(payload.get("artists"))
            return {
                "tracks": [self._track_result(item) for item in tracks],
                "albums": [self._album_result(item) for item in albums],
                "playlists": [self._playlist_result(item) for item in playlists],
                "artists": [self._artist_result(item) for item in artists],
            }
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @staticmethod
    def _valid_items(items):
        return [item for item in items or [] if isinstance(item, dict) and item.get("id")]

    async def queue(self):
        try:
            return [self._track_result(item) for item in await self.client.queue()]
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @staticmethod
    def _track_result(track: dict):
        return {
            "id": track.get("id"),
            "name": track.get("name", "Unknown track"),
            "artist": ", ".join(artist.get("name", "") for artist in track.get("artists", [])),
            "album": track.get("album", {}).get("name", ""),
            "cover_image": (track.get("album", {}).get("images") or [{}])[0].get("url"),
            "duration_ms": track.get("duration_ms", 0),
        }

    @staticmethod
    def _album_result(album: dict):
        return {
            "id": album.get("id"),
            "name": album.get("name", "Unknown album"),
            "artist": ", ".join(artist.get("name", "") for artist in album.get("artists", [])),
            "cover_image": (album.get("images") or [{}])[0].get("url"),
        }

    @staticmethod
    def _playlist_result(playlist: dict):
        owner = playlist.get("owner") or {}
        return {
            "id": playlist.get("id"),
            "name": playlist.get("name", "Untitled playlist"),
            "artist": owner.get("display_name") or owner.get("id", ""),
            "cover_image": (playlist.get("images") or [{}])[0].get("url"),
        }

    @staticmethod
    def _artist_result(artist: dict):
        return {
            "id": artist.get("id"),
            "name": artist.get("name", "Unknown artist"),
            "artist": "Artist",
            "cover_image": (artist.get("images") or [{}])[0].get("url"),
        }

    async def transfer(self, device_id: str):
        try:
            await self.client.transfer_playback(device_id)
            return await self.plugin.refresh()
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    async def control(self, action: str):
        try:
            await self.client.control(action)
            return await self.plugin.refresh()
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    async def seek(self, position_ms: int):
        try:
            await self.client.seek(position_ms)
            return await self.plugin.refresh()
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    async def volume(self, volume_percent: int):
        try:
            await self.client.set_volume(volume_percent)
            return await self.plugin.refresh()
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    async def shuffle(self, shuffle_state: bool):
        try:
            await self.client.set_shuffle(shuffle_state)
            return await self.plugin.refresh()
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    async def repeat(self, repeat_state: str):
        try:
            await self.client.set_repeat(repeat_state)
            return await self.plugin.refresh()
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    async def sync_albums(self):
        try:
            return await self.plugin.sync_albums()
        except (aiohttp.ClientError, TimeoutError) as error:
            raise HTTPException(
                status_code=502,
                detail="Cannot reach Spotify. Check container DNS/network access to api.spotify.com.",
            ) from error
        except (ValueError, KeyError) as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    async def recluster_albums(self):
        try:
            return await self.plugin.recluster_albums()
        except Exception as error:
            raise HTTPException(status_code=500, detail=f"Reclustering failed: {error}") from error

    async def clusters(self):
        return await self.plugin.clusters()

    async def rename_cluster(self, cluster_id: int, payload: dict = Body(...)):
        try:
            return await self.plugin.rename_cluster(cluster_id, payload.get("name", ""))
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    async def cluster(self, cluster_id: int):
        return await self.plugin.cluster(cluster_id)

    async def albums_by_tag(self, tag: str):
        return await self.plugin.albums_by_tag(tag)

    async def album_tags(self, album_id: str):
        return await self.plugin.album_tags(album_id)

    async def album(self, album_id: str):
        try:
            return await self.plugin.album_detail(album_id)
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    async def playlist(self, playlist_id: str):
        try:
            return await self.client.playlist(playlist_id)
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    async def play_album(self, album_id: str, device_id: str | None = None):
        try:
            await self.client.play_album(album_id, device_id)
            return await self.plugin.refresh()
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    async def play_playlist(self, playlist_id: str, device_id: str | None = None):
        try:
            await self.client.play_playlist(playlist_id, device_id)
            return await self.plugin.refresh()
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    async def play_track(self, track_id: str, device_id: str | None = None):
        try:
            await self.client.play_track(track_id, device_id)
            return await self.plugin.refresh()
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error