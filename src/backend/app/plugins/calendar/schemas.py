from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CalendarSource(BaseModel):
    id: int
    google_id: str
    name: str
    colour: str = "#5b8def"
    timezone: str = "Europe/London"
    can_write: bool = False
    is_default: bool = False


class CalendarVisibility(BaseModel):
    visible_source_ids: list[int] = []


class CalendarEvent(BaseModel):
    id: int
    source_id: int
    google_id: Optional[str] = None
    etag: Optional[str] = None
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    meeting_url: Optional[str] = None
    start: datetime
    end: datetime
    all_day: bool = False
    timezone: str = "Europe/London"
    colour: str = "#5b8def"


class CreateEvent(BaseModel):
    source_id: Optional[int] = None
    title: str = Field(min_length=1, max_length=500)
    description: Optional[str] = None
    location: Optional[str] = None
    start: datetime
    end: datetime
    all_day: bool = False
    timezone: str = "Europe/London"


class UpdateEvent(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    description: Optional[str] = None
    location: Optional[str] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    all_day: Optional[bool] = None
    timezone: Optional[str] = None


class CalendarState(BaseModel):
    dashboard_priority: int = 0
    page_priority: int = 65
    base_priority: int = 35
    connected: bool = False
    sync_status: str = "not_configured"
    last_synced_at: Optional[datetime] = None
    last_error: Optional[str] = None
    events_today: list[CalendarEvent] = []
    next_event: Optional[CalendarEvent] = None