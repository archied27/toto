from app.plugins.calendar.command import CalendarCommand
from app.plugins.calendar.controller.controller import CalendarController
from app.plugins.calendar.routes import CalendarRouter
from app.schemas.base_plugin import BasePlugin


class CalendarPlugin(BasePlugin):
    async def setup(self, core):
        self.controller = CalendarController(core)
        self.router = CalendarRouter(self.controller)
        self.command = CalendarCommand(self.controller)
        await self.controller.setup()

    def get_router(self):
        return self.router.router

    def get_ws_events(self):
        return ["calendar.state_updated"]

    def get_command(self):
        return self.command

    async def load_state(self):
        await self.controller.update_state()

    async def save_state(self):
        pass

    def get_name(self):
        return "calendar"