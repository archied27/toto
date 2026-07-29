from app.schemas.base_plugin import BasePlugin
from app.plugins.media.routes import MPVRouter
from app.plugins.media.controller.controller import MPVController

class MPVPlugin(BasePlugin):
    async def setup(self, core):
        self.controller = MPVController(core)
        self.router = MPVRouter(self.controller)
        
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
        pass

    def get_name(self):
        return "mpv"