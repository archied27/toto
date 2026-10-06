"""TMDB-ID media endpoints."""

from fastapi import APIRouter, Body, Query
from app.plugins.media.controller.controller import MediaController

class MediaRouter:
    def __init__(self, controller: MediaController):
        self.router = APIRouter()
        self.controller = controller
        self.router.add_api_route("/search", self.search, methods=["GET"])
        self.router.add_api_route("/items/{media_type}/{tmdb_id}", self.item, methods=["GET"])
        self.router.add_api_route("/playing", self.playing, methods=["GET"])
        self.router.add_api_route("/play", self.play, methods=["POST"])
        self.router.add_api_route("/stream", self.stream, methods=["POST"])
        self.router.add_api_route("/continue-watching", self.continue_watching, methods=["GET"])
        self.router.add_api_route("/watchlist", self.watchlist, methods=["GET"])
        self.router.add_api_route("/watchlist", self.add_to_watchlist, methods=["POST"])
        self.router.add_api_route("/watchlist/{media_type}/{tmdb_id}", self.remove_from_watchlist, methods=["DELETE"])
        self.router.add_api_route("/watchlist/{media_type}/{tmdb_id}/status", self.watchlist_status, methods=["GET"])
        self.router.add_api_route("/{agent_id}/{action}", self.control, methods=["POST"])

    async def search(self, query: str, media_type: str = "all"):
        return await self.controller.search(query, media_type)

    async def item(self, media_type: str, tmdb_id: int):
        return await self.controller.get_item(media_type, tmdb_id)

    async def playing(self, agent_id: str | None = Query(default=None)):
        return await self.controller.playing(agent_id)

    async def continue_watching(self):
        return await self.controller.get_continue_watching()

    async def play(self, payload: dict = Body(...)):
        return await self.controller.play(
            payload["media_type"], int(payload["tmdb_id"]), payload["agent_id"],
            payload.get("season_number"), payload.get("episode_number"), payload.get("start_seconds"),
        )

    async def stream(self, payload: dict = Body(...)):
        return await self.controller.stream(
            payload["media_type"], int(payload["tmdb_id"]),
            payload.get("season_number"), payload.get("episode_number"),
            payload.get("agent_id"), payload.get("start_seconds"),
        )

    async def control(self, agent_id: str, action: str, payload: dict = Body(default=None)):
        return await self.controller.control(agent_id, f"media_{action}", payload)

    async def watchlist(self):
        return await self.controller.get_watchlist()

    async def add_to_watchlist(self, payload: dict = Body(...)):
        return await self.controller.add_to_watchlist(
            payload["media_type"], int(payload["tmdb_id"])
        )

    async def remove_from_watchlist(self, media_type: str, tmdb_id: int):
        return await self.controller.remove_from_watchlist(media_type, tmdb_id)

    async def watchlist_status(self, media_type: str, tmdb_id: int):
        return await self.controller.check_watchlist_status(media_type, tmdb_id)