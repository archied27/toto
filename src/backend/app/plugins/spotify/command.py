from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.base_command import BaseCommand, CommandResult, IntentSpec


class SpotifyPlaybackSlots(BaseModel):
    action: Literal["play", "pause", "next", "previous"] = Field(
        description="The playback action: play, pause, next, or previous"
    )


class SpotifyCommand(BaseCommand):
    name = "spotify"

    def __init__(self, plugin):
        self.plugin = plugin

    def get_intents(self) -> list[IntentSpec]:
        return [
            IntentSpec(
                name="show_spotify",
                command_name="Show Spotify",
                description="open Spotify playback",
                type="nav",
                examples=["open Spotify", "show Spotify"],
            ),
            IntentSpec(
                name="now_playing",
                command_name="Show Currently Playing",
                description="show the song currently playing on Spotify",
                type="read",
                examples=["what is playing", "what song is playing", "show the current song"],
            ),
            IntentSpec(
                name="spotify_playback",
                command_name="Control Spotify Playback",
                description="play, pause, skip, or go back on Spotify",
                type="write",
                examples=["pause Spotify", "play Spotify", "skip this song", "go back a track"],
                slots=SpotifyPlaybackSlots,
                loading_msg="Controlling Spotify",
            ),
        ]

    async def handle(self, intent: str, extracted: dict, raw: str) -> CommandResult:
        if intent == "show_spotify":
            return CommandResult(True, "navigate", "Opening Spotify", {"page": "spotify"})

        if intent == "now_playing":
            state = await self.plugin.refresh()
            current = state.get("current")
            if not current:
                return CommandResult(True, intent, "Nothing is playing on Spotify", {"current": None})
            return CommandResult(
                True,
                intent,
                f"Now playing {current['track']} by {current['artists']}",
                {"current": current},
            )

        if intent == "spotify_playback":
            action = extracted.get("action")
            await self.plugin.client.control(action)
            state = await self.plugin.refresh()
            return CommandResult(True, intent, f"Spotify playback: {action}", state)

        return CommandResult(False, intent, "Spotify command not implemented", {})
