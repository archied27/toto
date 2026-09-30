"""TMDB-ID media coordinator backed by connected media agents."""

from __future__ import annotations

from typing import Any

from app.core.core import Core
from app.plugins.media.controller.media_db import MediaDb
from app.plugins.media.controller.tmdb_controller import TMDBApiController


class MediaController:
    def __init__(self, core: Core):
        self.core = core
        self.db = MediaDb(core.db_manager)
        self.tmdb: TMDBApiController | None = None

    async def setup(self) -> None:
        import json
        with open("app/plugins/media/config.json", encoding="utf-8") as config_file:
            config = json.load(config_file)
        self.tmdb = TMDBApiController(config["tmdb-api-key"])
        await self.db.initialise()
        if self.core.agents:
            self.core.agents.set_media_lifecycle_handlers(self.sync_agent, self.db.mark_agent_unavailable)

    async def search(self, query: str, media_type: str = "all") -> list[dict[str, Any]]:
        results = await self.tmdb.search_tmdb(query, media_type)
        enriched = []
        for result in results or []:
            item_type = "series" if result["media_type"] in {"tv", "show"} else "movie"
            item = await self.get_item(item_type, int(result["id"]))
            enriched.append(item or {**result, "tmdb_id": result["id"], "media_type": item_type, "available_on": []})
        return enriched

    async def get_item(self, media_type: str, tmdb_id: int) -> dict[str, Any] | None:
        item = await self.db.get_item(media_type, tmdb_id)
        if item is not None:
            item["id"] = tmdb_id
            return item
        details = await self._tmdb_details(media_type, tmdb_id)
        if details is None:
            return None
        await self.db.upsert_item(media_type, tmdb_id, details)
        result = await self.db.get_item(media_type, tmdb_id)
        result["id"] = tmdb_id
        return result

    async def _tmdb_details(self, media_type: str, tmdb_id: int) -> dict[str, Any] | None:
        if media_type == "movie":
            return await self.tmdb.get_movie_details(tmdb_id)
        return await self.tmdb.get_series_details(tmdb_id)

    async def sync_agent(self, agent_id: str) -> dict[str, Any]:
        if not self.core.agents or not self.core.agents.is_connected(agent_id):
            return {"status": "error", "message": "Media agent is not connected."}
        result = await self.core.agents.dispatch(agent_id, "media_library_refresh", {})
        if result.get("status") != "success":
            return result
        listing = await self.core.agents.dispatch(agent_id, "media_library_list", {})
        sources = listing.get("sources", [])
        await self.db.mark_agent_unavailable(agent_id)
        for source in sources:
            media_type = source["media_type"]
            tmdb_id = int(source["tmdb_id"])
            details = await self._tmdb_details("movie" if media_type == "movie" else "series", tmdb_id)
            if details is not None:
                await self.db.upsert_item("movie" if media_type == "movie" else "series", tmdb_id, details)
            await self.db.upsert_source(agent_id, source)
        return {"status": "success", "agent_id": agent_id, "source_count": len(sources)}

    async def sync_all_agents(self) -> list[dict[str, Any]]:
        if not self.core.agents:
            return []
        results = []
        for agent in self.core.agents.list_media_agents():
            results.append(await self.sync_agent(agent.device_id))
        return results

    async def play(self, media_type: str, tmdb_id: int, agent_id: str,
                   season_number: int | None = None, episode_number: int | None = None,
                   start_seconds: int | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "media_type": media_type,
            "tmdb_id": tmdb_id,
            "season_number": season_number,
            "episode_number": episode_number,
        }
        if start_seconds is not None:
            payload["start_seconds"] = start_seconds
        result = await self.core.agents.dispatch(agent_id, "media_play", payload)
        if result.get("tmdb_id") is not None:
            await self.db.save_state(agent_id, result)
        return result

    async def control(self, agent_id: str, action: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        result = await self.core.agents.dispatch(agent_id, action, payload or {})
        if result.get("tmdb_id") is not None or action == "media_stop":
            await self.db.save_state(agent_id, result)
        return result

    async def playing(self, agent_id: str | None = None) -> list[dict[str, Any]]:
        if self.core.agents:
            agents = self.core.agents.list_media_agents()
            if agent_id:
                agents = [agent for agent in agents if agent.device_id == agent_id]
            for agent in agents:
                state = await self.core.agents.dispatch(agent.device_id, "media_get_state", {})
                await self.db.save_state(agent.device_id, state)
        return await self.db.get_playing(agent_id)

    async def stream(self, media_type: str, tmdb_id: int,
                    season_number: int | None = None, episode_number: int | None = None) -> dict[str, Any]:
        """Generate movy.sx streaming URL and open in browser on host agent."""
        if media_type == "movie":
            url = f"https://www.movy.sx/movie/{tmdb_id}?play=true"
        elif media_type in ("series", "show", "tv", "episode"):
            if season_number is None or episode_number is None:
                return {"status": "error", "message": "Season and episode numbers required for series"}
            url = f"https://www.movy.sx/tv/{tmdb_id}/{season_number}/{episode_number}?play=true"
        else:
            return {"status": "error", "message": f"Unknown media_type: {media_type}"}

        # Open URL in default browser on host
        import webbrowser
        try:
            webbrowser.open(url)
            return {"status": "success", "url": url}
        except Exception as e:
            return {"status": "error", "message": f"Failed to open browser: {str(e)}"}
