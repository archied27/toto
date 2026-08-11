"""
handles logic for weather plugin
"""

from typing import Optional

from app.plugins.weather.schemas import WeatherAtTime, WeatherDaily, WeatherState
from app.plugins.weather.controller.weather_api import WeatherAPI
from app.core.core import Core
from dataclasses import asdict
import json

class WeatherController:
    def __init__(self, core: Core):
        self.core = core

        with open("app/plugins/weather/config.json", "r") as json_f:
            config = json.load(json_f)

        self.api_controller = WeatherAPI(
            longitude=config["longitude"],
            latitude=config["latitude"])

    async def setup(self):
        self.core.scheduler.add_recurring("weather.update", minute="*/10")
        self.core.bus.on("weather.update", self.update_state)


    async def get_current_weather(self) -> dict:
        """
        returns current weather details
        """
        return asdict(self.core.state.get("weather"))

    async def get_weather_for_date(self, iso_date: str) -> list[WeatherDaily]:
        """
        returns the daily forecast for a specific date (YYYY-MM-DD)
        """
        state = self.core.state.get("weather")
        if state is None:
            return []
        return [day for day in state.two_week_overview if day.time[:10] == iso_date]

    async def get_weather_range(self, start: str, end: str) -> list[WeatherDaily]:
        """
        returns the daily forecast within a date range (inclusive, YYYY-MM-DD)
        """
        state = self.core.state.get("weather")
        if state is None:
            return []
        return [day for day in state.two_week_overview if start <= day.time[:10] <= end]

    async def get_pollen_for_date(self, iso_date: str) -> Optional[float]:
        """
        returns the peak grass pollen level for a specific date (YYYY-MM-DD),
        or None if no pollen data is available for that date
        """
        state = self.core.state.get("weather")
        if state is None:
            return None
        levels = [
            hour.grass_pollen
            for hour in state.two_week_hourly
            if hour.time[:10] == iso_date and hour.grass_pollen is not None
        ]
        return max(levels) if levels else None

    async def update_state(self) -> None:
        """
        updates state with updated weather information
        """
        data = await self.api_controller.get_details()

        if data:
            await self.core.state.set("weather", WeatherState(
                current_weather=data["current_weather"],
                two_week_overview=data["two_week_overview"],
                two_week_hourly=data["two_week_hourly"]
            ))
            self.core.bus.emit_no_wait("weather.updated", asdict(self.core.state.get("weather")))

    async def load_state(self) -> None:
        """
        loads state from core state
        """
        return
