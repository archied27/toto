"""
to schedule and execute events on the bus at set times
"""

from typing import Any
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.job import Job
from apscheduler.jobstores.base import JobLookupError
from app.core.event_bus import EventBus

class Scheduler:
    def __init__(self, event_bus: EventBus):
        self.event_bus = event_bus
        self.scheduler = AsyncIOScheduler()
        self.scheduler.start()

    def add(self, event_name: str, run_at: datetime, data: Any = None):
        """
        adds event to scheduler
        event bus emits 'event_name' at 'run_at'
        """
        self.scheduler.add_job(
            self.event_bus.emit,
            trigger='date',
            next_run_time=run_at,
            name=event_name,
            args=[event_name, data]
        )

    def add_delayed(self, event_name: str, run_in: int, data: Any = None):
        """
        adds event to scheduler
        to be emited in 'run_in' seconds
        """
        run_at = (datetime.now(ZoneInfo("Europe/London")) + timedelta(seconds=run_in))
        self.add(event_name, run_at, data)

    def add_recurring(self, event_name: str, data: Any = None, **cron_kwargs):
        """
        adds recurring event to scheduler
        uses cron-style scheduling
        """
        self.scheduler.add_job(
            self.event_bus.emit,
            trigger='cron',
            name=event_name,
            args=[event_name, data],
            **cron_kwargs
        )

    def get_jobs(self) -> [Job]:
        """
        returns list of jobs scheduled
        Job object has attributes:
        id, name, func, next_run_time, etc
        """
        return self.scheduler.get_jobs()

    def remove_job(self, id: int):
        """
        removes job from scheduler with id
        """
        try:
            self.scheduler.remove_job(id)
        except JobLookupError:
            pass
