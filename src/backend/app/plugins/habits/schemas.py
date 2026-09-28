from datetime import date
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


ScheduleType = Literal["daily", "weekdays", "weekly_days", "interval"]
HabitStatus = Literal["active", "paused", "completed", "archived"]
OccurrenceStatus = Literal["not_due", "upcoming", "due", "completed", "missed", "rest"]


class CreateHabit(BaseModel):
    name: str = Field(min_length=1)
    description: Optional[str] = None
    colour: Optional[str] = None
    icon: Optional[str] = None
    schedule_type: ScheduleType = "daily"
    schedule_config: dict[str, Any] = Field(default_factory=dict)
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class UpdateHabit(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    description: Optional[str] = None
    colour: Optional[str] = None
    icon: Optional[str] = None
    schedule_type: Optional[ScheduleType] = None
    schedule_config: Optional[dict[str, Any]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[HabitStatus] = None


class Habit(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    colour: Optional[str] = None
    icon: Optional[str] = None
    schedule_type: ScheduleType
    schedule_config: dict[str, Any] = Field(default_factory=dict)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: HabitStatus
    created_at: str
    updated_at: str
    paused_at: Optional[str] = None
    completed_at: Optional[str] = None


class HabitSummary(BaseModel):
    habit: Habit
    status: OccurrenceStatus
    current_streak: int = 0
    best_streak: int = 0
    completed_count: int = 0
    due_count: int = 0
    completion_rate: float = 0.0
    next_due_date: Optional[str] = None


class HabitOccurrence(BaseModel):
    habit_id: int
    occurrence_date: str
    status: OccurrenceStatus
    completed_at: Optional[str] = None


class DailyProgress(BaseModel):
    date: str
    completed: int = 0
    due: int = 0
    percentage: Optional[float] = None


class HabitsState(BaseModel):
    dashboard_priority: int = 0
    page_priority: int = 15
    base_priority: int = 50
    active_habits: int = 0
    due_today: int = 0
    completed_today: int = 0
    missed_today: int = 0
    completion_percentage: float = 0.0
    current_streaks: list[dict[str, Any]] = Field(default_factory=list)
    today: list[HabitSummary] = Field(default_factory=list)


class HabitHistory(BaseModel):
    habit: Habit
    start_date: str
    end_date: str
    occurrences: list[HabitOccurrence] = Field(default_factory=list)
    progress: list[DailyProgress] = Field(default_factory=list)


class HabitsOverview(BaseModel):
    start_date: str
    end_date: str
    progress: list[DailyProgress] = Field(default_factory=list)
    active_habits: int = 0
    completed_occurrences: int = 0
    due_occurrences: int = 0
    completion_percentage: float = 0.0


class CompleteHabit(BaseModel):
    occurrence_date: Optional[str] = None
    source: Literal["ui", "command", "api"] = "api"


class HabitDateRange(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
