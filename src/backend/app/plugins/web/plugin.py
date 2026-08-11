"""
web plugin — gives the LLM a tool to search the web
"""

from fastapi import APIRouter

from app.schemas.base_plugin import BasePlugin
from app.plugins.web.controller.controller import WebController
from app.plugins.web.command import WebCommand


class WebPlugin(BasePlugin):
    async def setup(self, core):
        self.controller = WebController()
        self.router = APIRouter()  # no HTTP routes needed
        self.command = WebCommand(self.controller)

    def get_router(self):
        return self.router

    def get_ws_events(self):
        return []

    def get_name(self):
        return "web"

    def get_command(self):
        return self.command

    async def load_state(self):
        pass

    async def save_state(self):
        pass
