"""
handles parsing for tasks plugin
"""

from datetime import date, timedelta
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.core.dates import parse_date
from app.schemas.base_command import BaseCommand, MatchResult, CommandResult, IntentSpec
from app.plugins.tasks.controller.controller import TasksController
from app.plugins.tasks.schemas import CreateTask

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
        description=(
            "The due date as the user said it — copy their date words verbatim, "
            "in natural language (e.g. 'Friday', 'tomorrow', 'next week', 'August 14'). "
            "Do not convert it into an absolute date, ISO string, weekday number, "
            "or day/month number; our date parser converts this phrase for you. "
            "Only set when the text uses 'due' or 'by'; otherwise null."
        ),
    )
    todo_date: Optional[str] = Field(
        default=None,
        description=(
            "The to-do/scheduled date as the user said it — copy their date words "
            "verbatim, in natural language (e.g. 'Thursday', 'tomorrow', 'Monday'). "
            "Do not convert it into an absolute date, ISO string, weekday number, "
            "or day/month number; our date parser converts this phrase for you. "
            "Only set when the text uses 'to do' or 'for'; otherwise null."
        ),
    )

class TasksOnDateSlots(BaseModel):
    date: str = Field(
        description=(
            "The date the user asked about, copied verbatim in natural language "
            "(e.g. 'Friday', 'tomorrow', 'next week', 'the 20th', 'today'). "
            "Do not convert it into an absolute date, ISO string, or day/month "
            "number; our date parser converts this phrase for you."
        )
    )
    date_type: Literal["to_do", "due", "either"] = Field(
        default="either",
        description=(
            "Which date on the task to match: 'to_do' (scheduled for that day), "
            "'due' (deadline that day), or 'either'. Defaults to 'either'."
        ),
    )

class TasksDateRangeSlots(BaseModel):
    start_date: Optional[str] = Field(
        default=None,
        description=(
            "Start of the range, copied verbatim in natural language (e.g. 'Monday', "
            "'today', 'this week'). Our date parser converts it. Omit to default to today."
        ),
    )
    end_date: Optional[str] = Field(
        default=None,
        description=(
            "End of the range, copied verbatim in natural language (e.g. 'Friday', "
            "'this weekend', 'next week'). Our date parser converts it. "
            "Omit to default to 7 days after the start."
        ),
    )

class TasksByListSlots(BaseModel):
    list_name: str = Field(
        description=(
            "The name of the task list to show, as the user said it "
            "(e.g. 'Groceries', 'Work')., this should not include the word list"
        )
    )

class TasksByLabelSlots(BaseModel):
    label_name: str = Field(
        description=(
            "The name of the label to show tasks for, as the user said it "
            "(e.g. 'Important', 'School'). this should not include the word label"
        )
    )

class CompletedTasksOnDateSlots(BaseModel):
    date: str = Field(
        description=(
            "The date the user asked about, copied verbatim in natural language "
            "(e.g. 'yesterday', 'Friday', 'today'). Do not convert it into an "
            "absolute date or ISO string; our date parser converts this phrase for you."
        )
    )

class TasksCommand(BaseCommand):
    def __init__(self, controller: TasksController):
        self.controller = controller
        self.name = "tasks"

    def get_intents(self) -> list[IntentSpec]:
        return [
            IntentSpec(
                name="show_tasks",
                command_name="Show The Tasks Page",
                description="show the list of tasks",
                type="nav",
                examples=["show tasks", "open tasks", "display tasks"],
            ),
            IntentSpec(
                name="today_tasks",
                command_name="Show Today's Tasks",
                description="show the list of tasks for today",
                type="read",
                examples=["show today's tasks", "what are my tasks today", "tasks for today"],
            ),
            IntentSpec(
                name="tomorrow_tasks",
                command_name="Show Tomorrow's Tasks",
                description="show the list of tasks for tomorrow",
                type="read",
                examples=["show tomorrow's tasks", "what are my tasks tomorrow", "tasks for tomorrow"],
            ),
            IntentSpec(
                name="upcoming_tasks",
                command_name="Show Upcoming Tasks",
                description="show the list of upcoming tasks (tasks due in the future)",
                type="read",
                examples=["show upcoming tasks", "what are my upcoming tasks", "tasks due in the future", "show tasks due"],
            ),
            IntentSpec(
                name="tasks_on_date",
                command_name="Show Tasks On A Date",
                description="get the user's tasks on a specific date (scheduled for, due on, or either)",
                type="read",
                examples=[
                    "what tasks do I have on friday",
                    "tasks for monday",
                    "what's due on the 20th",
                    "what am I doing this weekend",
                    "tasks on august 20",
                ],
                slots=TasksOnDateSlots,
            ),
            IntentSpec(
                name="tasks_in_date_range",
                command_name="Show Tasks In A Date Range",
                description="get the user's tasks within a date range, by their due or scheduled date",
                type="read",
                examples=[
                    "what's due next week",
                    "what do I have from monday to friday",
                    "show me my tasks for the next 5 days",
                    "what's coming up this week",
                ],
                slots=TasksDateRangeSlots,
            ),
            IntentSpec(
                name="overdue_tasks",
                command_name="Show Overdue Tasks",
                description="get tasks that are past their due or scheduled date and not completed",
                type="read",
                examples=[
                    "what tasks are overdue",
                    "which tasks did I miss",
                    "show my late tasks",
                ],
            ),
            IntentSpec(
                name="tasks_by_list",
                command_name="Show Tasks By List",
                description="get tasks that belong to a named task list",
                type="read",
                examples=[
                    "what's in my groceries list",
                    "show tasks in the work list",
                    "what do I have in my shopping list",
                ],
                slots=TasksByListSlots,
            ),
            IntentSpec(
                name="tasks_by_label",
                command_name="Show Tasks By Label",
                description="get tasks that have a named label",
                type="read",
                examples=[
                    "show tasks with the important label",
                    "what tasks have the school label",
                    "list my work-tagged tasks",
                ],
                slots=TasksByLabelSlots,
            ),
            IntentSpec(
                name="get_completed_tasks",
                command_name="Show Completed Tasks",
                description="get the tasks the user completed on a specific date, by their completion date",
                type="read",
                examples=[
                    "did i do any tasks yesterday",
                    "what did i complete yesterday",
                    "show tasks I completed today",
                    "what did I finish on friday",
                    "did I complete my essay yesterday",
                ],
                slots=CompletedTasksOnDateSlots,
            ),
            IntentSpec(
                name="add_task",
                command_name="Add A New Task",
                description="add a new task directly from this input",
                type="write",
                examples=[
                    "add maths assignment due next friday",
                    "i need to call the dentist tomorrow",
                    "add essay due friday to do on thursday",
                    "add task coding problems for friday",
                    "add ai coursework to do thursday",
                ],
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
                loading_msg="Adding Task",
            ),
            IntentSpec(
                name="show_add_task",
                command_name="Input A New Task",
                description="show the add task form to add a new task",
                type="nav",
                examples=["add task", "new task", "create task", "add a new task", "create a new task"],
            ),
        ]

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
        if intent == "tasks_on_date":
            date_type = extracted.get("date_type", "either")
            if date_type not in ("due", "to_do", "either"):
                date_type = "either"
            iso = parse_date(extracted.get("date"))
            if not iso:
                return CommandResult(False, "tasks_on_date", f"Couldn't understand the date '{extracted.get('date')}'", {})
            tasks = await self.controller.get_tasks_on_date(iso, date_type)
            return CommandResult(True, "tasks_on_date", f"Tasks on {iso}: {len(tasks)}", {"tasks": tasks, "date": iso})
        if intent == "tasks_in_date_range":
            start = parse_date(extracted.get("start_date")) or date.today().isoformat()
            end = parse_date(extracted.get("end_date")) or (date.today() + timedelta(days=7)).isoformat()
            if start > end:
                start, end = end, start
            tasks = await self.controller.get_tasks_between(start, end)
            return CommandResult(True, "tasks_in_date_range", f"Tasks {start} to {end}: {len(tasks)}", {"tasks": tasks, "start_date": start, "end_date": end})
        if intent == "overdue_tasks":
            tasks = await self.controller.get_overdue_tasks()
            return CommandResult(True, "overdue_tasks", f"Overdue Tasks: {len(tasks)}", {"tasks": tasks})
        if intent == "tasks_by_list":
            lst = await self.controller.get_list_by_name(extracted["list_name"])
            if not lst:
                return CommandResult(False, "tasks_by_list", f"No list named '{extracted['list_name']}'", {})
            tasks = await self.controller.get_list_tasks(str(lst.id))
            return CommandResult(True, "tasks_by_list", f"Tasks in {lst.name}: {len(tasks)}", {"tasks": tasks, "list": lst})
        if intent == "tasks_by_label":
            label = await self.controller.get_label_by_name(extracted["label_name"])
            if not label:
                return CommandResult(False, "tasks_by_label", f"No label named '{extracted['label_name']}'", {})
            tasks = await self.controller.get_label_tasks(str(label.id))
            return CommandResult(True, "tasks_by_label", f"Tasks with {label.name}: {len(tasks)}", {"tasks": tasks, "label": label})
        if intent == "get_completed_tasks":
            iso = parse_date(extracted.get("date"))
            if not iso:
                return CommandResult(False, "get_completed_tasks", f"Couldn't understand the date '{extracted.get('date')}'", {})
            tasks = await self.controller.get_tasks_completed_on(iso)
            return CommandResult(True, "get_completed_tasks", f"Completed on {iso}: {len(tasks)}", {"tasks": tasks, "date": iso})
        if intent == "add_task":
            # parse due_date and todo_date if they exist
            due_date = parse_date(extracted.get("due_date"))
            todo_date = parse_date(extracted.get("todo_date"))

            task = CreateTask(
                title=extracted["task_name"],
                description=extracted.get("description"),
                due_date=due_date,
                to_do_date=todo_date
            )

            id = await self.controller.add_task(task)

            created_task = await self.controller.get_task(id)

            return CommandResult(True, "add_task", "Task added successfully", {"task": created_task})