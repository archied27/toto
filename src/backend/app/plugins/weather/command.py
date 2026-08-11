"""
handles parsing for weather plugin
"""

from dataclasses import asdict
from datetime import date, timedelta
from typing import Optional

from pydantic import BaseModel, Field

from app.core.dates import parse_date
from app.schemas.base_command import BaseCommand, MatchResult, CommandResult, IntentSpec
from app.plugins.weather.controller.controller import WeatherController


class ForecastDateSlots(BaseModel):
    date: str = Field(
        description=(
            "The date the user asked about, copied verbatim in natural language "
            "(e.g. 'Friday', 'tomorrow', 'this weekend'). Do not convert it into "
            "an absolute date or ISO string; our date parser converts this phrase for you."
        )
    )


class ForecastRangeSlots(BaseModel):
    start_date: Optional[str] = Field(
        default=None,
        description=(
            "Start of the range, copied verbatim in natural language (e.g. 'Monday', "
            "'today', 'this week'). Our date parser converts it. Omit to default to today."
        ),
    )
    end_date: Optional[str] = Field(
        default=None,
        description=(
            "End of the range, copied verbatim in natural language (e.g. 'Friday', "
            "'next week'). Our date parser converts it. "
            "Omit to default to 7 days after the start."
        ),
    )


class PollenForecastSlots(BaseModel):
    date: Optional[str] = Field(
        default=None,
        description=(
            "The date to check pollen for, copied verbatim in natural language "
            "(e.g. 'Wednesday', 'this week'). Omit for today."
        ),
    )


class WeatherCommand(BaseCommand):
    def __init__(self, controller: WeatherController):
        self.controller = controller
        self.name = "weather"

    def get_intents(self) -> list[IntentSpec]:
        return [
            IntentSpec(
                name="show_weather",
                command_name="Show Weather",
                description="open the weather app/screen",
                type="nav",
                examples=["show weather", "open weather", "display weather"],
            ),
            IntentSpec(
                name="show_pollen",
                command_name="Show Pollen Levels",
                description="get current pollen/allergen levels in grains/m^3",
                type="read",
                examples=["pollen count", "how bad is pollen today", "grass pollen", "hayfever today", "pollen levels"],
            ),
            IntentSpec(
                name="show_current_weather",
                command_name="Show Current Weather",
                description="get current temperature and conditions",
                type="read",
                examples=["what's the weather", "weather today", "forecast today", "is it cold outside", "what's the weather today"],
            ),
            IntentSpec(
                name="forecast_for_date",
                command_name="Show Forecast For A Date",
                description="get the weather forecast for a specific date",
                type="read",
                examples=[
                    "what's the weather on friday",
                    "what;s the rain forecast for tomorrow",
                    "is it going to be hot this weekend",
                    "what's the forecast for the 20th",
                    "weather on monday",
                ],
                slots=ForecastDateSlots,
            ),
            IntentSpec(
                name="forecast_range",
                command_name="Show Forecast Range",
                description="get the weather forecast for a date range (defaults to the next 7 days)",
                type="read",
                examples=[
                    "what's the forecast for this week",
                    "weather for the next 5 days",
                    "what's the weather like over the weekend",
                    "forecast for next week",
                ],
                slots=ForecastRangeSlots,
            ),
            IntentSpec(
                name="pollen_forecast",
                command_name="Show Pollen Forecast",
                description="get grass pollen levels for a specific date or range in grains/m^3",
                type="read",
                examples=[
                    "how bad is the pollen this week",
                    "will pollen be bad on wednesday",
                    "what's the grass pollen forecast",
                ],
                slots=PollenForecastSlots,
            ),
        ]

    async def handle(self, intent: str, extracted: dict, raw: str) -> CommandResult:
        if intent == "show_weather":
            return CommandResult(True, "navigate", "Opening Weather", {"navigate_to": "weather"})

        if intent == "show_pollen":
            await self.controller.update_state()
            pollen = (await self.controller.get_current_weather())["current_weather"]["grass_pollen"]
            return CommandResult(True, "show_pollen", f"Grass Pollen: {pollen}", {"pollen": pollen})

        if intent == "show_current_weather":
            await self.controller.update_state()
            w = (await self.controller.get_current_weather())["current_weather"]
            return CommandResult(True, "show_current_weather",
                                  f"Current Weather: {w['temp']}°C",
                                  {"temperature": w["temp"], "code": w["code"], "is_day": w["is_day"]})

        if intent == "forecast_for_date":
            await self.controller.update_state()
            iso = parse_date(extracted.get("date"))
            if not iso:
                return CommandResult(False, "forecast_for_date", f"Couldn't understand the date '{extracted.get('date')}'", {})
            days = await self.controller.get_weather_for_date(iso)
            if not days:
                return CommandResult(
                    True,
                    "forecast_for_date",
                    f"No forecast available for {iso} (outside the 14-day window)",
                    {"date": iso, "forecast": []},
                )
            return CommandResult(
                True,
                "forecast_for_date",
                f"Forecast for {iso}",
                {"date": iso, "forecast": [asdict(d) for d in days]},
            )

        if intent == "forecast_range":
            await self.controller.update_state()
            start = parse_date(extracted.get("start_date")) or date.today().isoformat()
            end = parse_date(extracted.get("end_date")) or (date.today() + timedelta(days=7)).isoformat()
            if start > end:
                start, end = end, start
            days = await self.controller.get_weather_range(start, end)
            return CommandResult(
                True,
                "forecast_range",
                f"Forecast {start} to {end}",
                {"start_date": start, "end_date": end, "forecast": [asdict(d) for d in days]},
            )

        if intent == "pollen_forecast":
            await self.controller.update_state()
            raw_date = extracted.get("date")
            iso = parse_date(raw_date) if raw_date else date.today().isoformat()
            if raw_date and not iso:
                return CommandResult(False, "pollen_forecast", f"Couldn't understand the date '{raw_date}'", {})
            level = await self.controller.get_pollen_for_date(iso)
            if level is None:
                return CommandResult(
                    True,
                    "pollen_forecast",
                    f"No pollen data for {iso} (only available for the next 7 days)",
                    {"date": iso, "grass_pollen": None},
                )
            return CommandResult(
                True,
                "pollen_forecast",
                f"Grass pollen on {iso}: {level}",
                {"date": iso, "grass_pollen": level},
            )
