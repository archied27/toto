from app.schemas.base_plugin import BasePlugin
from app.plugins.media.routes import MediaRouter
from app.plugins.media.controller.media_controller import MediaController
from app.plugins.media.state import MediaState

class MediaPlugin(BasePlugin):
    async def setup(self, core):
        self.core = core
        self.controller = MediaController(core)
        self.router = MediaRouter(self.controller)

        await self.controller.setup()

    def get_router(self):
        return self.router.router

    def get_ws_events(self):
        return []

    def get_command(self):
        return None

    async def save_state(self):
        pass

    async def load_state(self):
        # Initialize media state with page_priority so it appears in pages
        state = MediaState(page_priority=20)
        await self.core.state.set("media", state)

    def get_name(self):
        return "media"