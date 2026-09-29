from fastapi import APIRouter, HTTPException

from app.plugins.habits.controller.controller import HabitsController
from app.plugins.habits.schemas import (
    CompleteHabit,
    CreateHabit,
    HabitDateRange,
    UpdateHabit,
)


class HabitsRouter:
    def __init__(self, controller: HabitsController):
        self.controller = controller
        self.router = APIRouter()
        self.router.add_api_route("/state", self.get_state, methods=["GET"])
        self.router.add_api_route("", self.get_habits, methods=["GET"])
        self.router.add_api_route("", self.create_habit, methods=["POST"])
        self.router.add_api_route("/today", self.get_today, methods=["GET"])
        self.router.add_api_route("/day", self.get_day, methods=["GET"])
        self.router.add_api_route("/overview", self.get_overview, methods=["GET"])
        self.router.add_api_route("/{habit_id}", self.get_habit, methods=["GET"])
        self.router.add_api_route("/{habit_id}", self.update_habit, methods=["PATCH"])
        self.router.add_api_route("/{habit_id}", self.delete_habit, methods=["DELETE"])
        self.router.add_api_route("/{habit_id}/history", self.get_history, methods=["GET"])
        self.router.add_api_route("/{habit_id}/complete", self.complete, methods=["POST"])
        self.router.add_api_route("/{habit_id}/complete/{occurrence_date}", self.undo, methods=["DELETE"])
        self.router.add_api_route("/{habit_id}/pause", self.pause, methods=["POST"])
        self.router.add_api_route("/{habit_id}/resume", self.resume, methods=["POST"])
        self.router.add_api_route("/{habit_id}/complete-goal", self.complete_goal, methods=["POST"])

    @staticmethod
    def _bad_request(error: ValueError):
        raise HTTPException(status_code=400, detail=str(error))

    async def get_state(self):
        return await self.controller.get_state()

    async def get_habits(self, include_inactive: bool = False):
        return await self.controller.get_habits(include_inactive)

    async def create_habit(self, body: CreateHabit):
        try:
            return await self.controller.create_habit(body)
        except ValueError as error:
            self._bad_request(error)

    async def get_today(self):
        return await self.controller.get_today()

    async def get_day(self, date: str | None = None):
        try:
            return await self.controller.get_day(date)
        except ValueError as error:
            self._bad_request(error)

    async def get_overview(self, start_date: str | None = None, end_date: str | None = None):
        try:
            return await self.controller.get_overview(start_date, end_date)
        except ValueError as error:
            self._bad_request(error)

    async def get_habit(self, habit_id: int):
        habit = await self.controller.get_habit(habit_id)
        if not habit:
            raise HTTPException(status_code=404, detail="Habit not found")
        return habit

    async def update_habit(self, habit_id: int, body: UpdateHabit):
        try:
            return await self.controller.update_habit(habit_id, body)
        except LookupError as error:
            raise HTTPException(status_code=404, detail=str(error))
        except ValueError as error:
            self._bad_request(error)

    async def delete_habit(self, habit_id: int):
        try:
            await self.controller.delete_habit(habit_id)
            return {"message": "Habit deleted successfully"}
        except LookupError as error:
            raise HTTPException(status_code=404, detail=str(error))

    async def get_history(self, habit_id: int, start_date: str | None = None,
                          end_date: str | None = None):
        try:
            return await self.controller.get_history(habit_id, start_date, end_date)
        except LookupError as error:
            raise HTTPException(status_code=404, detail=str(error))
        except ValueError as error:
            self._bad_request(error)

    async def complete(self, habit_id: int, body: CompleteHabit):
        try:
            return await self.controller.complete(habit_id, body.occurrence_date, body.source)
        except LookupError as error:
            raise HTTPException(status_code=404, detail=str(error))
        except ValueError as error:
            self._bad_request(error)

    async def undo(self, habit_id: int, occurrence_date: str):
        try:
            return await self.controller.undo(habit_id, occurrence_date)
        except LookupError as error:
            raise HTTPException(status_code=404, detail=str(error))
        except ValueError as error:
            self._bad_request(error)

    async def pause(self, habit_id: int):
        return await self._set_status(habit_id, "paused")

    async def resume(self, habit_id: int):
        return await self._set_status(habit_id, "active")

    async def complete_goal(self, habit_id: int):
        return await self._set_status(habit_id, "completed")

    async def _set_status(self, habit_id: int, status: str):
        try:
            return await self.controller.set_status(habit_id, status)
        except LookupError as error:
            raise HTTPException(status_code=404, detail=str(error))
