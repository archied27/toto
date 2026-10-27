from datetime import datetime, timedelta
from pydantic import BaseModel, Field

from app.plugins.calendar.controller.controller import CalendarController
from app.schemas.base_command import BaseCommand, CommandResult, IntentSpec


class CalendarRangeSlots(BaseModel):
    date: str = Field(description="The date phrase copied verbatim, such as today, tomorrow, or Friday")


class CreateEventSlots(BaseModel):
    title: str = Field(description="The event title")
    start: str = Field(description="The event start date and time copied verbatim in UK time")
    end: str | None = Field(default=None, description="The event end date and time copied verbatim, or null when duration is not given")
    location: str | None = None


class CalendarCommand(BaseCommand):
    name = "calendar"

    def __init__(self, controller: CalendarController):
        self.controller = controller

    def get_intents(self):
        return [
            IntentSpec(name="show_calendar", command_name="Show Calendar", description="open the calendar", type="nav", examples=["show calendar", "open my calendar"]),
            IntentSpec(name="upcoming_events", command_name="Show Upcoming Events", description="show upcoming calendar events", type="read", examples=["what is on my calendar", "show my upcoming events", "what do I have coming up"]),
            IntentSpec(name="events_on_date", command_name="Show Events On A Date", description="show calendar events on a date", type="read", examples=["what is on my calendar tomorrow", "what meetings do I have Friday"], slots=CalendarRangeSlots),
            IntentSpec(name="create_event", command_name="Create Calendar Event", description="create a calendar event", type="write", examples=["add a calendar event", "schedule a meeting"], slots=CreateEventSlots, loading_msg="Creating Event"),
        ]

    async def handle(self, intent: str, extracted: dict, raw: str):
        if intent == "show_calendar":
            return CommandResult(True, "navigate", "Opening calendar", {"page": "calendar"})
        if intent in {"upcoming_events", "events_on_date"}:
            now = datetime.now().astimezone()
            events = await self.controller.get_events(now, now + timedelta(days=30))
            return CommandResult(True, intent, f"Found {len(events)} upcoming events", {"events": [event.model_dump(mode="json") for event in events]})
        if intent == "create_event":
            return CommandResult(False, intent, "Calendar event creation is ready for the connected calendar.", extracted)
        return CommandResult(False, intent, "Calendar command not implemented", {})