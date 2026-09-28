from app.plugins.habits.command import HabitsCommand
from app.plugins.habits.controller.controller import HabitsController
from app.plugins.habits.routes import HabitsRouter
from app.schemas.base_plugin import BasePlugin


class HabitsPlugin(BasePlugin):
    async def setup(self, core):
        self.controller = HabitsController(core)
        self.router = HabitsRouter(self.controller)
        self.command = HabitsCommand(self.controller)
        await self.controller.setup()

    def get_router(self):
        return self.router.router

    def get_ws_events(self):
        return ["habits.state_updated"]

    def get_command(self):
        return self.command

    async def load_state(self):
        await self.controller.update_state()

    async def save_state(self):
        pass

    def get_name(self):
        return "habits"
