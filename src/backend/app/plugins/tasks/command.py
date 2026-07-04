"""
handles parsing for tasks plugin
"""

from app.schemas.base_command import BaseCommand, MatchResult, CommandResult
from app.plugins.tasks.controller.controller import TasksController

class TasksCommand(BaseCommand):
    PATTERNS = []

    def __init__(self, controller: TasksController):
        self.controller = controller
        self.name = "tasks"

    def get_intents(self) -> list[IntentSpec]:
        return []

    async def handle(self, match: MatchResult, raw: str) -> CommandResult:
        pass