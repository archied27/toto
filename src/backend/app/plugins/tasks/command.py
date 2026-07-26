"""
handles parsing for tasks plugin
"""

from app.schemas.base_command import BaseCommand, MatchResult, CommandResult, IntentSpec
from app.plugins.tasks.controller.controller import TasksController
from app.plugins.tasks.schemas import CreateTask
from pydantic import BaseModel, Field
from typing import Optional
import dateparser

class AddTaskSlots(BaseModel):
    task_name: str = Field(
        description="The task itself, capitalized like a title, e.g. 'Complete Essay'. Do not include the due or to-do date here."
    )
    description: Optional[str] = Field(
        default=None,
        description="Extra detail beyond the task name, only if the text gives more context than the name alone. Do not include dates here. Usually null."
    )
    due_date: Optional[str] = Field(
        default=None,
        description="The due date in natural language, only if the text uses 'due' or 'by'. Null otherwise."
    )
    todo_date: Optional[str] = Field(
        default=None,
        description="The to-do/scheduled date in natural language, only if the text uses 'to do' or 'for'. Null otherwise."
    )
class TasksCommand(BaseCommand):
    def __init__(self, controller: TasksController):
        self.controller = controller
        self.name = "tasks"

    def get_intents(self) -> list[IntentSpec]:
        return [
            IntentSpec("show_tasks", "Show The Tasks Page", "show the list of tasks",
                       ["show tasks", "open tasks", "display tasks"]),
            IntentSpec("today_tasks", "Show Today's Tasks", "show the list of tasks for today",
                       ["show today's tasks", "what are my tasks today", "tasks for today"]),
            IntentSpec("tomorrow_tasks", "Show Tomorrow's Tasks", "show the list of tasks for tomorrow",
                       ["show tomorrow's tasks", "what are my tasks tomorrow", "tasks for tomorrow"]),
            IntentSpec("upcoming_tasks", "Show Upcoming Tasks", "show the list of upcoming tasks (tasks due in the future)",
                       ["show upcoming tasks", "what are my upcoming tasks", "tasks due in the future", "show tasks due"]),
            IntentSpec("add_task", "Add A New Task", "add a new task directly from this input",
                       ["add maths assignment due next friday", "i need to call the dentist tomorrow", "add essay due friday to do on thursday", "add task coding problems for friday", "add ai coursework to do thursday"], 
                       slots=AddTaskSlots, 
                       slot_examples=[
                            ("add essay due friday to do on thursday",
                            {"task_name": "Essay", "description": None, "due_date": "Friday", "todo_date": "Thursday"}),
                            ("add ai coursework to do thursday",
                            {"task_name": "AI Coursework", "description": None, "due_date": None, "todo_date": "Thursday"}),
                            ("call the dentist tomorrow to schedule an appointment",
                            {"task_name": "Call Dentist", "description": "Call Dentist to Schedule Appointment", "due_date": None, "todo_date": "Tomorrow"}),
                            ("add maths cw for friday",
                            {"task_name": "Maths Coursework", "description": None, "due_date": None, "todo_date": "Friday"}),
                            ("add ai cw due tomorrow",
                            {"task_name": "AI Coursework", "description": None, "due_date": "Tomorrow", "todo_date": None}),
                            ("add ai coursework due tomorrow to do on friday",
                            {"task_name": "AI Coursework", "description": None, "due_date": "Tomorrow", "todo_date": "Friday"}),
                            ("add ai coursework due tomorrow to do on friday with extra details",
                            {"task_name": "AI Coursework", "description": "With Extra Details", "due_date": "Tomorrow", "todo_date": "Friday"}),
                        ],
                        loading_msg="Adding Task"),
            IntentSpec("show_add_task", "Input A New Task", "show the add task form to add a new task",
                       ["add task", "new task", "create task", "add a new task", "create a new task"]),
        ]

    def get_intent(self, intent_name: str) -> Optional[IntentSpec]:
        for intent in self.get_intents():
            if intent.name == intent_name:
                return intent
        return None

    async def handle(self, intent: str, extracted: dict, raw: str) -> CommandResult:
        if intent == "show_tasks":
            return CommandResult(True, "navigate", "Opening Tasks", {"navigate_to": "tasks"})
        if intent == "show_add_task":
            return CommandResult(True, "navigate", "Opening Add Task Form", {"navigate_to": "tasks", "params": {"addTask": True}})
        if intent == "today_tasks":
            tasks = await self.controller.get_todays_tasks()
            return CommandResult(True, "today_tasks", f"Today's Tasks: {len(tasks)}", {"tasks": tasks})
        if intent == "tomorrow_tasks":
            tasks = await self.controller.get_tomorrow_tasks()
            return CommandResult(True, "tomorrow_tasks", f"Tomorrow's Tasks: {len(tasks)}", {"tasks": tasks})
        if intent == "upcoming_tasks":
            tasks = await self.controller.get_upcoming_tasks()
            return CommandResult(True, "upcoming_tasks", f"Upcoming Tasks: {len(tasks)}", {"tasks": tasks})
        if intent == "add_task":
            # parse due_date and todo_date if they exist
            if extracted["due_date"]:
                extracted["due_date"] = dateparser.parse(extracted["due_date"], settings={"PREFER_DATES_FROM": "future", "DATE_ORDER": "DMY"}).date().isoformat()
            if extracted["todo_date"]:
                extracted["todo_date"] = dateparser.parse(extracted["todo_date"], settings={"PREFER_DATES_FROM": "future", "DATE_ORDER": "DMY"}).date().isoformat()

            task = CreateTask(
                title=extracted["task_name"],
                description=extracted.get("description"),
                due_date=extracted.get("due_date"),
                to_do_date=extracted.get("todo_date")
            )

            id = await self.controller.add_task(task)

            created_task = await self.controller.get_task(id)

            return CommandResult(True, "add_task", "Task added successfully", {"task": created_task})