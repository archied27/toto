from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.core.core import Core
from app.core.dates import parse_date
from app.plugins.habits.controller.db_controller import HabitsDBController
from app.plugins.habits.recurrence import is_scheduled, scheduled_dates, validate_schedule
from app.plugins.habits.schemas import (
    CreateHabit,
    DailyProgress,
    Habit,
    HabitHistory,
    HabitOccurrence,
    HabitSummary,
    HabitsOverview,
    HabitsState,
    UpdateHabit,
)


class HabitsController:
    def __init__(self, core: Core):
        self.core = core
        self.db_controller = HabitsDBController(core)

    async def setup(self):
        await self.db_controller.create_tables()
        await self.update_state()
        self.core.bus.on("habits.update_state", self.update_state)
        self.core.scheduler.add_recurring("habits.update_state", hour="*/1")

    @staticmethod
    def _date(value: str | None, default: date | None = None) -> date:
        if not value:
            if default is None:
                raise ValueError("A date is required")
            return default
        parsed = parse_date(value)
        if not parsed:
            raise ValueError(f"Could not understand date '{value}'")
        return date.fromisoformat(parsed)

    @staticmethod
    def _iso(value: date | None) -> str | None:
        return value.isoformat() if value else None

    @staticmethod
    def _schedule_config(schedule_type: str, config: dict[str, Any]) -> dict[str, Any]:
        config = dict(config or {})
        if schedule_type == "weekdays":
            config = {"days": [0, 1, 2, 3, 4]}
        elif schedule_type == "daily":
            config = {}
        elif schedule_type == "weekly_days":
            config["days"] = sorted(config.get("days", []))
        elif schedule_type == "interval":
            config["interval_days"] = config.get("interval_days", 1)
        validate_schedule(schedule_type, config)
        return config

    @staticmethod
    def _in_date_bounds(habit: Habit, value: date) -> bool:
        start = date.fromisoformat(habit.start_date) if habit.start_date else None
        end = date.fromisoformat(habit.end_date) if habit.end_date else None
        return (start is None or value >= start) and (end is None or value <= end)

    @staticmethod
    def _habit_start(habit: Habit) -> date | None:
        return date.fromisoformat(habit.start_date) if habit.start_date else None

    def _scheduled(self, habit: Habit, value: date) -> bool:
        if not self._in_date_bounds(habit, value):
            return False
        if habit.status == "paused" and habit.paused_at:
            paused_date = date.fromisoformat(habit.paused_at[:10])
            if value >= paused_date:
                return False
        return is_scheduled(habit.schedule_type, habit.schedule_config, value, self._habit_start(habit))

    async def _status(self, habit: Habit, value: date, completions: dict[str, str] | None = None) -> str:
        completions = completions or await self.db_controller.get_completions(
            habit.id, value.isoformat(), value.isoformat()
        )
        key = value.isoformat()
        if key in completions:
            return "completed"
        if not self._scheduled(habit, value):
            return "rest" if self._in_date_bounds(habit, value) else "not_due"
        today = date.today()
        if value > today:
            return "upcoming"
        if value == today:
            return "due"
        return "missed"

    async def _streaks(self, habit: Habit, through: date | None = None) -> tuple[int, int]:
        through = through or date.today()
        start = self._habit_start(habit) or through - timedelta(days=730)
        start = min(start, through)
        completions = await self.db_controller.get_completions(
            habit.id, start.isoformat(), through.isoformat()
        )
        scheduled = scheduled_dates(
            habit.schedule_type, habit.schedule_config, start, through, self._habit_start(habit)
        )
        scheduled = [value for value in scheduled if self._scheduled(habit, value)]
        completed_dates = {value for value in scheduled if value.isoformat() in completions}

        best = current = 0
        previous: date | None = None
        for value in scheduled:
            if value in completed_dates:
                if previous is not None and (value - previous).days > 1:
                    current = 0
                current += 1
                best = max(best, current)
            else:
                current = 0
            previous = value

        current = 0
        for value in reversed(scheduled):
            if value in completed_dates:
                current += 1
            else:
                break
        return current, best

    async def _summary(self, habit: Habit, value: date | None = None) -> HabitSummary:
        value = value or date.today()
        start = value - timedelta(days=730)
        completions = await self.db_controller.get_completions(
            habit.id, start.isoformat(), value.isoformat()
        )
        due_dates = [d for d in scheduled_dates(
            habit.schedule_type, habit.schedule_config, start, value, self._habit_start(habit)
        ) if self._scheduled(habit, d)]
        completed_count = sum(d.isoformat() in completions for d in due_dates)
        current, best = await self._streaks(habit, value)
        next_due = None
        for offset in range(0, 366):
            candidate = value + timedelta(days=offset)
            if self._scheduled(habit, candidate):
                next_due = candidate.isoformat()
                break
        return HabitSummary(
            habit=habit,
            status=await self._status(habit, value, completions),
            current_streak=current,
            best_streak=best,
            completed_count=completed_count,
            due_count=len(due_dates),
            completion_rate=round((completed_count / len(due_dates)) * 100, 2) if due_dates else 0,
            next_due_date=next_due,
        )

    async def update_state(self):
        habits = await self.db_controller.get_habits()
        today = date.today()
        summaries = [await self._summary(habit, today) for habit in habits]
        due = sum(summary.status == "due" for summary in summaries)
        completed = sum(summary.status == "completed" for summary in summaries)
        missed = sum(summary.status == "missed" for summary in summaries)
        state = HabitsState(
            dashboard_priority=min(100, due * 30),
            page_priority=max(25, min(100, due * 10)),
            active_habits=len(habits),
            due_today=due,
            completed_today=completed,
            missed_today=missed,
            completion_percentage=round((completed / due) * 100, 2) if due else 0,
            current_streaks=[
                {"habit_id": summary.habit.id, "name": summary.habit.name,
                 "current_streak": summary.current_streak}
                for summary in summaries if summary.current_streak
            ],
            today=summaries,
        )
        old_state = self.core.state.get("habits")
        if old_state is None or old_state != state:
            await self.core.state.set("habits", state)
            self.core.bus.emit_no_wait("habits.state_updated", state.model_dump(mode="json"))
            self.core.bus.emit_no_wait("dashboard.rerank")
            self.core.bus.emit_no_wait("pages.rerank")

    async def get_state(self) -> HabitsState:
        state = self.core.state.get("habits")
        if state is None:
            await self.update_state()
            state = self.core.state.get("habits")
        return state

    async def create_habit(self, habit: CreateHabit) -> Habit:
        config = self._schedule_config(habit.schedule_type, habit.schedule_config)
        start = self._date(habit.start_date) if habit.start_date else None
        end = self._date(habit.end_date) if habit.end_date else None
        if start and end and start > end:
            raise ValueError("start_date cannot be after end_date")
        if habit.schedule_type == "interval" and start is None:
            start = date.today()
        habit_id = await self.db_controller.add_habit(habit, config, self._iso(start), self._iso(end))
        await self.update_state()
        return await self.db_controller.get_habit(habit_id)

    async def get_habit(self, habit_id: int) -> Habit | None:
        return await self.db_controller.get_habit(habit_id)

    async def get_habits(self, include_inactive: bool = False) -> list[Habit]:
        return await self.db_controller.get_habits(include_inactive)

    async def update_habit(self, habit_id: int, update: UpdateHabit) -> Habit:
        current = await self.db_controller.get_habit(habit_id)
        if not current:
            raise LookupError("Habit not found")
        values = update.model_dump(exclude_unset=True)
        schedule_type = values.get("schedule_type", current.schedule_type)
        schedule_config = values.get("schedule_config", current.schedule_config)
        values["schedule_config"] = self._schedule_config(schedule_type, schedule_config)
        for key in ("start_date", "end_date"):
            if key in values and values[key]:
                values[key] = self._date(values[key]).isoformat()
        start = values.get("start_date", current.start_date)
        end = values.get("end_date", current.end_date)
        if start and end and start > end:
            raise ValueError("start_date cannot be after end_date")
        await self.db_controller.update_habit(habit_id, values)
        await self.update_state()
        return await self.db_controller.get_habit(habit_id)

    async def set_status(self, habit_id: int, status: str) -> Habit:
        habit = await self.db_controller.get_habit(habit_id)
        if not habit:
            raise LookupError("Habit not found")
        values: dict[str, Any] = {"status": status}
        if status == "paused":
            values["paused_at"] = datetime.now(timezone.utc).isoformat()
        elif status == "completed":
            values["completed_at"] = datetime.now(timezone.utc).isoformat()
        elif status == "active":
            values["paused_at"] = None
        await self.db_controller.update_habit(habit_id, values)
        await self.update_state()
        return await self.db_controller.get_habit(habit_id)

    async def delete_habit(self, habit_id: int):
        habit = await self.db_controller.get_habit(habit_id)
        if not habit:
            raise LookupError("Habit not found")
        await self.db_controller.delete_habit(habit_id)
        await self.update_state()

    async def complete(self, habit_id: int, occurrence_date: str | None, source: str):
        habit = await self.db_controller.get_habit(habit_id)
        if not habit:
            raise LookupError("Habit not found")
        target = self._date(occurrence_date, date.today())
        if not self._in_date_bounds(habit, target):
            raise ValueError("Date is outside the habit's configured date range")
        if not self._scheduled(habit, target):
            raise ValueError("Habit is not scheduled for that date")
        await self.db_controller.complete(habit_id, target.isoformat(), source)
        await self.update_state()
        return await self._summary(habit, date.today())

    async def undo(self, habit_id: int, occurrence_date: str):
        habit = await self.db_controller.get_habit(habit_id)
        if not habit:
            raise LookupError("Habit not found")
        target = self._date(occurrence_date)
        await self.db_controller.undo(habit_id, target.isoformat())
        await self.update_state()
        return await self._summary(habit, date.today())

    async def get_today(self) -> list[HabitSummary]:
        return (await self.get_state()).today

    async def get_day(self, selected_date: str | None) -> list[HabitSummary]:
        value = self._date(selected_date, date.today())
        habits = await self.db_controller.get_habits()
        summaries = [await self._summary(habit, value) for habit in habits]
        return [summary for summary in summaries if summary.status != "rest"]

    async def get_overview(self, start_date: str | None, end_date: str | None) -> HabitsOverview:
        end = self._date(end_date, date.today())
        start = self._date(start_date, end - timedelta(days=364))
        if start > end:
            start, end = end, start
        habits = await self.db_controller.get_habits()
        progress: list[DailyProgress] = []
        for value in (start + timedelta(days=i) for i in range((end - start).days + 1)):
            due = completed = 0
            for habit in habits:
                if self._scheduled(habit, value):
                    due += 1
                    completions = await self.db_controller.get_completions(
                        habit.id, value.isoformat(), value.isoformat()
                    )
                    completed += value.isoformat() in completions
            progress.append(DailyProgress(
                date=value.isoformat(), completed=completed, due=due,
                percentage=round(completed / due * 100, 2) if due else None,
            ))
        completed_total = sum(item.completed for item in progress)
        due_total = sum(item.due for item in progress)
        return HabitsOverview(
            start_date=start.isoformat(), end_date=end.isoformat(), progress=progress,
            active_habits=len(habits), completed_occurrences=completed_total,
            due_occurrences=due_total,
            completion_percentage=round(completed_total / due_total * 100, 2) if due_total else 0,
        )

    async def get_history(self, habit_id: int, start_date: str | None, end_date: str | None) -> HabitHistory:
        habit = await self.db_controller.get_habit(habit_id)
        if not habit:
            raise LookupError("Habit not found")
        end = self._date(end_date, date.today())
        start = self._date(start_date, end - timedelta(days=364))
        if start > end:
            start, end = end, start
        completions = await self.db_controller.get_completions(
            habit_id, start.isoformat(), end.isoformat()
        )
        occurrences = []
        progress = []
        for value in (start + timedelta(days=i) for i in range((end - start).days + 1)):
            status = await self._status(habit, value, completions)
            occurrences.append(HabitOccurrence(
                habit_id=habit_id, occurrence_date=value.isoformat(), status=status,
                completed_at=completions.get(value.isoformat()),
            ))
            due = status in ("completed", "due", "missed")
            progress.append(DailyProgress(
                date=value.isoformat(), completed=int(status == "completed"), due=int(due),
                percentage=100.0 if status == "completed" else (0.0 if due else None),
            ))
        return HabitHistory(
            habit=habit, start_date=start.isoformat(), end_date=end.isoformat(),
            occurrences=occurrences, progress=progress,
        )

    async def find_by_name(self, name: str) -> list[Habit]:
        return await self.db_controller.find_by_name(name)
