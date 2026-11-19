from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.base_command import BaseCommand, CommandResult, IntentSpec


class MediaSearchSlots(BaseModel):
    query: str = Field(description="The movie or series title to search for")
    media_type: Literal["movie", "series", "all"] = Field(
        default="all", description="The type of media to search for"
    )


class MediaControlSlots(BaseModel):
    action: Literal["toggle_pause", "pause", "play"] = Field(
        description="The playback action to send to the current media"
    )
    agent_id: str | None = Field(
        default=None, description="The media agent to control, when the user names one"
    )


class MediaCommand(BaseCommand):
    name = "media"

    def __init__(self, controller):
        self.controller = controller

    def get_intents(self) -> list[IntentSpec]:
        return [
            IntentSpec(
                name="show_media",
                command_name="Show Media",
                description="open the media dashboard",
                type="nav",
                examples=["open media", "show my media"],
            ),
            IntentSpec(
                name="search_media",
                command_name="Search Media",
                description="search for a movie or series",
                type="read",
                examples=["find the film Dune", "search for Breaking Bad", "look up movies about space"],
                slots=MediaSearchSlots,
                loading_msg="Searching media",
            ),
            IntentSpec(
                name="continue_watching",
                command_name="Show Continue Watching",
                description="show unfinished movies and series",
                type="read",
                examples=["what should I continue watching", "show my unfinished shows"],
            ),
            IntentSpec(
                name="media_playback",
                command_name="Control Media Playback",
                description="pause, play, or resume the current movie or series",
                type="write",
                examples=["pause the movie", "resume playback", "play the show"],
                slots=MediaControlSlots,
                loading_msg="Controlling media",
            ),
        ]

    async def handle(self, intent: str, extracted: dict, raw: str) -> CommandResult:
        if intent == "show_media":
            return CommandResult(True, "navigate", "Opening media", {"page": "media"})

        if intent == "search_media":
            query = extracted.get("query") or raw
            media_type = extracted.get("media_type") or "all"
            results = await self.controller.search(query, media_type)
            return CommandResult(
                True,
                intent,
                f"Found {len(results)} media results for '{query}'",
                {"query": query, "results": results},
            )

        if intent == "continue_watching":
            items = await self.controller.get_continue_watching()
            return CommandResult(True, intent, f"Found {len(items)} items to continue watching", {"items": items})

        if intent == "media_playback":
            agent_id = extracted.get("agent_id")
            if not agent_id:
                playing = await self.controller.playing()
                items = playing.get("items", [])
                if len(items) == 1:
                    agent_id = items[0]["agent_id"]
                elif not items:
                    return CommandResult(False, intent, "Nothing is currently playing", {})
                else:
                    return CommandResult(False, intent, "Choose which media device to control", {"items": items})
            result = await self.controller.control(agent_id, f"media_{extracted['action']}", {})
            success = result.get("status") == "success"
            return CommandResult(success, intent, result.get("message", "Media playback updated"), result)

        return CommandResult(False, intent, "Media command not implemented", {})
