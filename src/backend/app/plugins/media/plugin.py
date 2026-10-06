from app.schemas.base_plugin import BasePlugin
from app.plugins.media.routes import MediaRouter
from app.plugins.media.controller.controller import MediaController
from app.plugins.media.state import MediaState

class MediaPlugin(BasePlugin):
    async def setup(self, core):
        self.core = core
        self.controller = MediaController(core)
        self.router = MediaRouter(self.controller)
        core.bus.on("media.playing.updated", self.update_dashboard_priority)

        await self.controller.setup()

        # Re-evaluate the watching card regularly so both dashboard and page
        # ordering follow the current playback state.
        if core and getattr(core, "scheduler", None):
            core.scheduler.add_recurring(
                "media.update_dashboard_priority",
                self.update_dashboard_priority,
                second="*/30"
            )

    def get_router(self):
        return self.router.router

    def get_ws_events(self):
        return []

    def get_command(self):
        return None

    async def save_state(self):
        pass

    async def load_state(self):
        state = MediaState(page_priority=20, dashboard_priority=0)
        await self.core.state.set("media", state)
        await self.update_dashboard_priority()

    async def update_dashboard_priority(self, playing_result=None):
        """Set priorities based on whether the currently watching card exists."""
        if playing_result is None:
            playing_result = await self.controller.playing()
        is_playing = len(playing_result.get("items", [])) > 0

        page_priority = 90 if is_playing else 20
        dashboard_priority = 90 if is_playing else 0

        current_state = self.core.state.get("media")
        # If state hasn't been initialized yet, use default values
        if current_state is None:
            current_state = MediaState(page_priority=20, dashboard_priority=0)

        if current_state.page_priority != page_priority or current_state.dashboard_priority != dashboard_priority:
            state = MediaState(page_priority=page_priority, dashboard_priority=dashboard_priority)
            await self.core.state.set("media", state)
            self.core.bus.emit_no_wait("dashboard.rerank")
            self.core.bus.emit_no_wait("pages.rerank")

    def get_name(self):
        return "media"