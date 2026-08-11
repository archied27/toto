"""
handles parsing for web plugin
"""

from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.base_command import BaseCommand, CommandResult, IntentSpec
from app.plugins.web.controller.controller import WebController


class WebSearchSlots(BaseModel):
    query: str = Field(
        description=(
            "The search query, derived from the user's question. "
            "Use keywords the user cares about; keep it concise."
        )
    )
    max_results: Optional[int] = Field(
        default=10,
        description="The maximum number of results to return (default: 10)",
    )


class WebCommand(BaseCommand):
    def __init__(self, controller: WebController):
        self.controller = controller
        self.name = "web"

    def get_intents(self) -> list[IntentSpec]:
        return [
            IntentSpec(
                name="web_search",
                command_name="Search The Web",
                description="search the web for current information, facts, or news",
                type="read",
                examples=[
                    "search the web for current AI news",
                    "what is the latest on X",
                    "look up how to do Y in Python",
                    "search for nearby Z restaurants",
                ],
                slots=WebSearchSlots,
                loading_msg="Searching the web",
            ),
        ]

    async def handle(self, intent: str, extracted: dict, raw: str) -> CommandResult:
        if intent == "web_search":
            query = extracted.get("query") or raw
            max_results = int(extracted.get("max_results") or 10)
            results = await self.controller.search(query, max_results=max_results)
            return CommandResult(
                True,
                "web_search",
                f"Found {len(results)} results for '{query}'",
                {"query": query, "results": results},
            )
