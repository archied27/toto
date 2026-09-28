from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.core.dates import parse_date
from app.plugins.habits.controller.controller import HabitsController
from app.plugins.habits.schemas import CreateHabit
from app.schemas.base_command import BaseCommand, CommandResult, IntentSpec


class CreateHabitSlots(BaseModel):
    name: str = Field(description="The habit name, without schedule words.")
    schedule_type: Literal["daily", "weekdays", "weekly_days", "interval"] = Field(
        default="daily", description="The friendly recurrence preset. Use weekdays for Monday-Friday."
    )
    schedule_config: dict = Field(
        default_factory=dict,
        description="Schedule data. For weekly_days use days 0-6 Monday-Sunday; for interval use interval_days.",
    )
    start_date: Optional[str] = Field(default=None, description="Start date phrase, copied verbatim.")
    end_date: Optional[str] = Field(default=None, description="End date phrase, copied verbatim.")


class HabitNameSlots(BaseModel):
    name: str = Field(description="The habit name as the user said it.")


class HabitDateSlots(BaseModel):
    name: str = Field(description="The habit name as the user said it.")
    date: Optional[str] = Field(default=None, description="The completion date phrase, copied verbatim.")


class ManageHabitSlots(BaseModel):
    name: str = Field(description="The habit name as the user said it.")
    action: Literal["pause", "resume", "complete"] = Field(description="The lifecycle action to perform.")


class HabitsCommand(BaseCommand):
    def __init__(self, controller: HabitsController):
        self.controller = controller
        self.name = "habits"

    def get_intents(self) -> list[IntentSpec]:
        return [
            IntentSpec("show_habits", "Show Habits", "open the habits page", "nav",
                       ["show habits", "open habits", "display my habits"]),
            IntentSpec("create_habit", "Create A Habit", "create a recurring habit", "write",
                       ["add gym on weekdays", "meditate every day", "create a habit to drink water"],
                       CreateHabitSlots, loading_msg="Adding Habit"),
            IntentSpec("complete_habit", "Complete A Habit", "record a habit completion", "write",
                       ["I went to the gym", "mark meditation done", "I completed my habit"],
                       HabitDateSlots, loading_msg="Recording Habit"),
            IntentSpec("undo_habit", "Undo A Habit Completion", "undo a habit completion", "write",
                       ["I did not meditate yesterday", "undo gym yesterday"],
                       HabitDateSlots, loading_msg="Updating Habit"),
            IntentSpec("review_habits", "Review Habits", "review habit progress and streaks", "read",
                       ["how are my habits doing", "show my streaks", "review habit progress"]),
            IntentSpec("manage_habit", "Manage A Habit", "pause, resume, or finish a habit", "write",
                       ["pause my gym habit", "resume meditation", "finish my 30 day challenge"],
                       ManageHabitSlots, loading_msg="Updating Habit"),
        ]

    async def _find_one(self, name: str) -> tuple[object | None, CommandResult | None]:
        matches = await self.controller.find_by_name(name)
        if not matches:
            return None, CommandResult(False, "habit_not_found", f"No active habit named '{name}'", {})
        if len(matches) > 1:
            names = [habit.name for habit in matches[:5]]
            return None, CommandResult(False, "habit_ambiguous", "Which habit did you mean?", {"habits": names})
        return matches[0], None

    async def handle(self, intent: str, extracted: dict, raw: str) -> CommandResult:
        if intent == "show_habits":
            return CommandResult(True, "navigate", "Opening Habits", {"navigate_to": "habits"})

        if intent == "create_habit":
            start = parse_date(extracted.get("start_date"))
            end = parse_date(extracted.get("end_date"))
            try:
                habit = await self.controller.create_habit(CreateHabit(
                    name=extracted["name"], schedule_type=extracted.get("schedule_type", "daily"),
                    schedule_config=extracted.get("schedule_config") or {},
                    start_date=start, end_date=end,
                ))
            except (KeyError, ValueError) as error:
                return CommandResult(False, "create_habit", str(error), {})
            return CommandResult(True, "create_habit", f"Created habit: {habit.name}", {"habit": habit})

        if intent in ("complete_habit", "undo_habit"):
            habit, error = await self._find_one(extracted.get("name", ""))
            if error:
                return error
            target = parse_date(extracted.get("date")) or date.today().isoformat()
            try:
                summary = (await self.controller.complete(habit.id, target, "command")
                           if intent == "complete_habit"
                           else await self.controller.undo(habit.id, target))
            except (ValueError, LookupError) as exception:
                return CommandResult(False, intent, str(exception), {})
            action = "complete_habit" if intent == "complete_habit" else "undo_habit"
            return CommandResult(True, action, f"Updated {habit.name} for {target}", {"summary": summary})

        if intent == "review_habits":
            state = await self.controller.get_state()
            return CommandResult(True, "review_habits", f"You have {state.active_habits} active habits", {"state": state})

        if intent == "manage_habit":
            habit, error = await self._find_one(extracted.get("name", ""))
            if error:
                return error
            action = extracted.get("action")
            status = {"pause": "paused", "resume": "active", "complete": "completed"}.get(action)
            if not status:
                return CommandResult(False, "manage_habit", f"Unknown habit action '{action}'", {})
            try:
                updated = await self.controller.set_status(habit.id, status)
            except LookupError as exception:
                return CommandResult(False, "manage_habit", str(exception), {})
            return CommandResult(True, "manage_habit", f"Updated {updated.name}", {"habit": updated})

        return CommandResult(False, intent, "I couldn't handle that habit command", {})
