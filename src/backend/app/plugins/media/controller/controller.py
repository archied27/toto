"""
handles logic for media plugin
"""

from app.plugins.media.controller.media_db import MediaDb
from app.plugins.media.controller.tmdb_controller import TMDBApiController
from app.plugins.media.schemas import MPVState
from app.core.core import Core
import json

from datetime import datetime, timezone


class MediaController:
    def __init__(self, core: Core):
        self.core = core
        self.media_db = MediaDb(self.core.db_manager) if getattr(self.core, "db_manager", None) is not None else None
        self._streaming_sessions: dict[str, tuple[str, int]] = {}

    def _build_stream_url(self, media_type: str, tmdb_id: int, season_number: int | None = None, episode_number: int | None = None) -> str:
        media_type = (media_type or "").lower()
        if media_type in {"movie", "movies"}:
            return f"https://www.movy.sx/movie/{tmdb_id}?play=true"
        if media_type in {"series", "tv", "show"}:
            if season_number is None or episode_number is None:
                raise ValueError("Series streaming requires season_number and episode_number")
            return f"https://www.movy.sx/tv/{tmdb_id}/{season_number}/{episode_number}?play=true"
        raise ValueError(f"Unsupported media type: {media_type}")

    async def stream(self, media_type: str, tmdb_id: int, season_number: int | None = None, episode_number: int | None = None, agent_id: str | None = None, start_seconds: int | None = None):
        """Open the target title in a connected agent browser."""
        if not self.core or not getattr(self.core, "agents", None):
            return {"status": "error", "message": "No connected agents are available."}

        try:
            url = self._build_stream_url(media_type, tmdb_id, season_number, episode_number)
            # Add timestamp fragment if start_seconds provided
            if start_seconds is not None and start_seconds > 0:
                url = f"{url}#t={start_seconds}"
        except ValueError as exc:
            return {"status": "error", "message": str(exc)}

        registry = self.core.agents
        connected = registry.list_media_agents()
        eligible_agents = [
            agent for agent in connected
            if any(getattr(capability, "name", None) == "open_url" for capability in getattr(agent, "capabilities", []))
        ]
        if not eligible_agents:
            return {"status": "error", "message": "No connected media agent can open browser streams."}

        eligible_ids = {getattr(agent, "device_id", agent) for agent in eligible_agents}
        if agent_id is None:
            if len(eligible_agents) > 1:
                return {"status": "error", "message": "Choose a media agent before starting the stream."}
            agent_id = getattr(eligible_agents[0], "device_id", eligible_agents[0])
        elif agent_id not in eligible_ids:
            return {"status": "error", "message": f"Agent '{agent_id}' cannot open browser streams."}

        try:
            result = await registry.dispatch(agent_id, "open_url", {"url": url})
        except TypeError:
            result = await registry.dispatch(agent_id, "media", "open_url", {"url": url})
        except Exception as exc:
            return {"status": "error", "message": f"Failed to stream on agent '{agent_id}': {exc}"}

        return {"status": "success", "agent_id": agent_id, "url": url, "result": result}

    async def playing(self, agent_id: str | None = None):
        """Return active browser playback sessions from media agents."""
        registry = getattr(self.core, "agents", None)
        if registry is None:
            return {"status": "success", "items": []}

        agents = registry.list_media_agents()
        if agent_id is not None:
            agents = [agent for agent in agents if agent.device_id == agent_id]

        items = []
        for agent in agents:
            try:
                result = await registry.dispatch(agent.device_id, "media_get_state", {})
            except Exception:
                continue
            state = result.get("state", result) if isinstance(result, dict) else {}
            # Check if we have valid media context (similar to update_streaming_progress)
            media_type = (state.get("media_type") or "").lower()
            tmdb_id = state.get("tmdb_id")
            if media_type not in {"movie", "series"} or tmdb_id is None:
                continue
            state = dict(state)
            state["agent_id"] = agent.device_id
            state["agent_name"] = agent.display_name or agent.device_id
            items.append(state)

        result = {"status": "success", "items": items}
        self.core.bus.emit_no_wait("media.playing.updated", result)
        return result

    async def control(self, agent_id: str, action: str, payload: dict | None = None):
        """Dispatch a playback control to one connected media agent."""
        registry = getattr(self.core, "agents", None)
        if registry is None:
            return {"status": "error", "message": "No connected agents are available."}

        media_agents = {agent.device_id for agent in registry.list_media_agents()}
        if agent_id not in media_agents:
            return {"status": "error", "message": f"Media agent '{agent_id}' is not connected."}

        try:
            result = await registry.dispatch(agent_id, action, payload or {})
        except Exception as exc:
            return {"status": "error", "message": str(exc)}
        if result.get("status") == "success" and action in {"media_pause", "media_toggle_pause"}:
            await self.update_streaming_progress()
        return result

    async def play(self, media_type: str, tmdb_id: int, agent_id: str | None = None, season_number: int | None = None, episode_number: int | None = None, start_seconds: int | None = None):
        """Compatibility wrapper; the current implementation streams via the agent browser."""
        payload = {
            "media_type": media_type,
            "tmdb_id": tmdb_id,
            "season_number": season_number,
            "episode_number": episode_number,
            "start_seconds": start_seconds,
        }
        if season_number is not None and episode_number is not None:
            return await self.stream(media_type, tmdb_id, season_number=season_number, episode_number=episode_number, agent_id=agent_id)
        return await self.stream(media_type, tmdb_id, agent_id=agent_id)

    async def update_state(self):
        new_state = MPVState()
        await self.core.state.set("media", new_state)
        self.core.bus.emit_no_wait("pages.rerank")

    async def setup(self):
        with open("app/plugins/media/config.json", "r") as json_f:
            data = json.load(json_f)

        self.tmdb = TMDBApiController(data["tmdb-api-key"])
        await self.media_db.initialise()
        await self.update_state()

        # Schedule progress updates for streaming sessions every 1 minute
        if self.core and getattr(self.core, "scheduler", None):
            self.core.scheduler.add_recurring(
                "media.update_streaming_progress",
                self.update_streaming_progress,
                minute="*/1"  # Every 1 minute
            )

    async def update_streaming_progress(self):
        """Persist active agent positions and cache their TMDB metadata."""
        if not self.media_db:
            return

        registry = getattr(self.core, "agents", None)
        if registry is None:
            return

        for agent in registry.list_media_agents():
            try:
                result = await registry.dispatch(agent.device_id, "media_get_state", {})
                state = result.get("state", result) if isinstance(result, dict) else {}
                media_type = (state.get("media_type") or "").lower()
                tmdb_id = state.get("tmdb_id")
                if media_type not in {"movie", "series"} or tmdb_id is None:
                    continue

                tmdb_id = int(tmdb_id)
                position = max(0, int(state.get("position_seconds") or 0))
                duration = max(0, int(state.get("duration_seconds") or 0))
                completed = state.get("status") == "completed" or (
                    duration > 0 and position >= duration * 0.9
                )
                watched_at = datetime.now(timezone.utc)

                await self.media_db.save_state(agent.device_id, {
                    **state,
                    "media_type": media_type,
                    "tmdb_id": tmdb_id,
                    "position_seconds": position,
                    "duration_seconds": duration or None,
                    "completed": completed,
                    "updated_at": watched_at.isoformat(),
                })

                await self._get_cached_tmdb_details(media_type, tmdb_id)
                await self.media_db.upsert_source(agent.device_id, {
                    "media_type": media_type,
                    "tmdb_id": tmdb_id,
                    "season_number": state.get("season_number"),
                    "episode_number": state.get("episode_number"),
                    "duration_seconds": duration or None,
                })
            except Exception:
                continue

    async def _get_cached_tmdb_details(self, media_type: str, tmdb_id: int):
        if await self.media_db.has_item(media_type, tmdb_id):
            return None

        try:
            details = await self.get_item(media_type, tmdb_id)
        except Exception:
            return None
        if details is not None:
            await self.media_db.upsert_item(media_type, tmdb_id, details)
        return details

    async def search(self, query: str, media_type: str = "all"):
        """
        searches tmdb for movies and/or series matching the query
        """
        return await self.tmdb.search_tmdb(query, media_type)

    async def get_movie_details(self, id: int):
        """
        fetches and returns movie details
        """
        return await self.tmdb.get_movie_details(id)

    async def get_series_details(self, id: int):
        """
        fetches and returns series details
        """
        return await self.tmdb.get_series_details(id)

    async def get_item(self, media_type: str, tmdb_id: int):
        """Return TMDB details for the media item route."""
        normalized_type = (media_type or "").lower()
        normalized_type = "movie" if normalized_type in {"movie", "movies"} else "series" if normalized_type in {"series", "tv", "show"} else normalized_type
        cached = await self.media_db.get_item(normalized_type, tmdb_id)
        details = cached
        if details is None:
            details = await self.get_movie_details(tmdb_id) if normalized_type == "movie" else await self.get_series_details(tmdb_id)
            if details is not None:
                await self.media_db.upsert_item(normalized_type, tmdb_id, details)
        if details is not None:
            await self._attach_progress(normalized_type, tmdb_id, details)
            return details
        raise ValueError(f"Unsupported media type: {media_type}")

    async def _attach_progress(self, media_type: str, tmdb_id: int, details: dict):
        progress_rows = await self.media_db.get_progress(media_type, tmdb_id)
        if media_type == "movie":
            if progress_rows:
                details.update(progress_rows[0])
            return

        progress_by_episode = {
            (row["season_number"], row["episode_number"]): row
            for row in progress_rows
        }
        for season_number, season in enumerate(details.get("seasons", []), start=1):
            for episode in season.get("episodes", []):
                progress = progress_by_episode.get((season_number, episode.get("episode_num")))
                if progress:
                    episode.update(progress)

    async def get_full_series_details(self, id: int):
        """
        fetches and returns series details with all seasons and episodes
        """
        series_details = await self.tmdb.get_series_details(id)
        seasons = []
        for season in range(1, series_details["number_of_seasons"] + 1):
            season_details = await self.tmdb.get_season_details(id, season)
            seasons.append(season_details)

        series_details["seasons"] = seasons
        return series_details

    async def get_continue_watching(self):
        """
        returns persisted progress for movies and episodes, ordered by last_watched
        """
        return await self.media_db.db.fetch_all(
            """
            SELECT
                CASE WHEN p.media_type = 'movie' THEN p.tmdb_id ELSE p.rowid END AS id,
                COALESCE(i.title, 'Unknown') AS title,
                json_extract(i.metadata_json, '$.poster_path') AS poster_path,
                p.duration_seconds,
                p.position_seconds AS progress_seconds,
                p.last_watched,
                '' AS file_path,
                CASE WHEN p.media_type = 'movie' THEN 'movie' ELSE 'episode' END AS media_type,
                p.season_number,
                p.episode_number,
                CASE WHEN p.media_type = 'series' THEN p.tmdb_id END AS series_tmdb_id
            FROM media_progress p
            LEFT JOIN media_items i
                ON i.media_type = p.media_type AND i.tmdb_id = p.tmdb_id
            WHERE p.position_seconds > 0 AND p.completed = 0
            ORDER BY p.last_watched DESC
            """
        )

    async def add_to_watchlist(self, media_type: str, tmdb_id: int):
        """Add a movie or series to the watchlist."""
        await self.media_db.add_to_watchlist(media_type, tmdb_id)
        await self._get_cached_tmdb_details(media_type, tmdb_id)
        return {"status": "success", "message": "Added to watchlist"}

    async def remove_from_watchlist(self, media_type: str, tmdb_id: int):
        """Remove a movie or series from the watchlist."""
        await self.media_db.remove_from_watchlist(media_type, tmdb_id)
        return {"status": "success", "message": "Removed from watchlist"}

    async def get_watchlist(self):
        """Get all watchlist items."""
        items = await self.media_db.get_watchlist()
        for item in items:
            item["in_watchlist"] = True
        return items

    async def check_watchlist_status(self, media_type: str, tmdb_id: int):
        """Check if an item is in the watchlist."""
        in_watchlist = await self.media_db.is_in_watchlist(media_type, tmdb_id)
        return {"in_watchlist": in_watchlist}
