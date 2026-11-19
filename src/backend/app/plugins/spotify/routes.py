import secrets

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
        self.router.add_api_route("/control/{action}", self.control, methods=["POST"])
        self.router.add_api_route("/albums/sync", self.sync_albums, methods=["POST"])
        self.router.add_api_route("/clusters", self.clusters, methods=["GET"])
        self.router.add_api_route("/clusters/{cluster_id}/name", self.rename_cluster, methods=["PUT"])
        self.router.add_api_route("/clusters/{cluster_id}", self.cluster, methods=["GET"])
        self.router.add_api_route("/albums/{album_id}/play", self.play_album, methods=["POST"])

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

    async def control(self, action: str):
        try:
            await self.client.control(action)
            return await self.plugin.refresh()
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    async def sync_albums(self):
        try:
            return await self.plugin.sync_albums()
        except (ValueError, KeyError) as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    async def clusters(self):
        return await self.plugin.clusters()

    async def rename_cluster(self, cluster_id: int, payload: dict = Body(...)):
        try:
            return await self.plugin.rename_cluster(cluster_id, payload.get("name", ""))
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    async def cluster(self, cluster_id: int):
        return await self.plugin.cluster(cluster_id)

    async def play_album(self, album_id: str):
        try:
            await self.client.play_album(album_id)
            return await self.plugin.refresh()
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error