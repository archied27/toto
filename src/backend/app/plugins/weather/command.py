from app.schemas.base_command import BaseCommand, MatchResult, CommandResult, IntentSpec
from app.plugins.weather.controller.controller import WeatherController

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
                description="get current pollen/allergen levels",
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