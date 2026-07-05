"""
handles parsing for tasks plugin
"""

from app.schemas.base_command import BaseCommand, MatchResult, CommandResult, IntentSpec
from app.plugins.tasks.controller.controller import TasksController

class TasksCommand(BaseCommand):
    def __init__(self, controller: TasksController):
        self.controller = controller
        self.name = "tasks"

    def get_intents(self) -> list[IntentSpec]:
        return [
            IntentSpec("show_tasks", "show the list of tasks",
                       ["show tasks", "open tasks", "display tasks"]),
            IntentSpec("today_tasks", "show the list of tasks for today",
                       ["show today's tasks", "what are my tasks today", "tasks for today"]),
            IntentSpec("tomorrow_tasks", "show the list of tasks for tomorrow",
                       ["show tomorrow's tasks", "what are my tasks tomorrow", "tasks for tomorrow"]),
        ]

    async def handle(self, intent: str, extracted: dict, raw: str) -> CommandResult:
        if intent == "show_tasks":
            return CommandResult(True, "navigate", "Opening Tasks", {"navigate_to": "tasks"})
        if intent == "today_tasks":
            tasks = await self.controller.get_todays_tasks()
            return CommandResult(True, "today_tasks", f"Today's Tasks: {len(tasks)}", {"tasks": tasks})
        if intent == "tomorrow_tasks":
            tasks = await self.controller.get_tomorrow_tasks()
            return CommandResult(True, "tomorrow_tasks", f"Tomorrow's Tasks: {len(tasks)}", {"tasks": tasks})