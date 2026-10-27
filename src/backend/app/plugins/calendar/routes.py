from datetime import datetime

import secrets

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.plugins.calendar.controller.controller import CalendarController
from app.plugins.calendar.google_client import GoogleCalendarNotConfigured
from app.plugins.calendar.schemas import CalendarVisibility, CreateEvent, UpdateEvent


class CalendarRouter:
    def __init__(self, controller: CalendarController):
        self.controller = controller
        self.router = APIRouter()
        self.router.add_api_route("/state", self.state, methods=["GET"])
        self.router.add_api_route("/connect", self.connect, methods=["GET"])
        self.router.add_api_route("/oauth/callback", self.oauth_callback, methods=["GET"])
        self.router.add_api_route("/sync", self.sync, methods=["POST"])
        self.router.add_api_route("/sources", self.sources, methods=["GET"])
        self.router.add_api_route("/visibility", self.visibility, methods=["GET"])
        self.router.add_api_route("/visibility", self.update_visibility, methods=["PUT"])
        self.router.add_api_route("/events", self.events, methods=["GET"])
        self.router.add_api_route("/events", self.create, methods=["POST"])
        self.router.add_api_route("/events/{event_id}", self.update, methods=["PATCH"])
        self.router.add_api_route("/events/{event_id}", self.delete, methods=["DELETE"])

    async def state(self):
        return await self.controller.get_state()

    async def connect(self):
        try:
            state = secrets.token_urlsafe(24)
            self.controller.oauth_state = state
            return {"authorization_url": self.controller.google.authorization_url(state)}
        except GoogleCalendarNotConfigured as error:
            raise HTTPException(status_code=503, detail=str(error)) from error

    async def oauth_callback(self, code: str, state: str):
        if state != self.controller.oauth_state:
            raise HTTPException(status_code=400, detail="Invalid OAuth state")
        await self.controller.complete_oauth(code)
        return RedirectResponse(url="/calendar")

    async def sync(self):
        await self.controller.sync()
        return await self.controller.get_state()

    async def sources(self):
        return await self.controller.get_sources()

    async def visibility(self):
        return await self.controller.get_visibility()

    async def update_visibility(self, preferences: CalendarVisibility):
        return await self.controller.set_visibility(preferences.visible_source_ids)

    async def events(self, start: datetime, end: datetime, source_ids: list[int] | None = Query(default=None)):
        return await self.controller.get_events(start, end, source_ids)

    async def create(self, event: CreateEvent):
        try:
            return await self.controller.create_event(event)
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    async def update(self, event_id: int, changes: UpdateEvent):
        try:
            return await self.controller.update_event(event_id, changes)
        except ValueError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error

    async def delete(self, event_id: int):
        await self.controller.delete_event(event_id)
        return {"success": True}