from datetime import date, timedelta
from typing import Any


VALID_SCHEDULE_TYPES = {"daily", "weekdays", "weekly_days", "interval"}


def validate_schedule(schedule_type: str, schedule_config: dict[str, Any]) -> None:
    if schedule_type not in VALID_SCHEDULE_TYPES:
        raise ValueError(f"Unsupported schedule type: {schedule_type}")

    if schedule_type == "weekly_days":
        days = schedule_config.get("days")
        if not isinstance(days, list) or not days or any(
            not isinstance(day, int) or day < 0 or day > 6 for day in days
        ):
            raise ValueError("weekly_days requires days containing weekday numbers 0-6")
        if len(set(days)) != len(days):
            raise ValueError("weekly_days cannot contain duplicate days")

    if schedule_type == "interval":
        interval_days = schedule_config.get("interval_days")
        if not isinstance(interval_days, int) or interval_days < 1:
            raise ValueError("interval requires interval_days greater than zero")


def is_scheduled(schedule_type: str, schedule_config: dict[str, Any], occurrence_date: date,
                 start_date: date | None = None) -> bool:
    validate_schedule(schedule_type, schedule_config)
    if schedule_type == "daily":
        return True
    if schedule_type == "weekdays":
        return occurrence_date.weekday() < 5
    if schedule_type == "weekly_days":
        return occurrence_date.weekday() in schedule_config["days"]
    if start_date is None:
        raise ValueError("interval schedules require a start date")
    return (occurrence_date - start_date).days % schedule_config["interval_days"] == 0


def scheduled_dates(schedule_type: str, schedule_config: dict[str, Any], start: date, end: date,
                    habit_start: date | None = None) -> list[date]:
    if start > end:
        return []
    dates: list[date] = []
    current = start
    interval_start = habit_start or start
    while current <= end:
        if is_scheduled(schedule_type, schedule_config, current, interval_start):
            dates.append(current)
        current += timedelta(days=1)
    return dates
