from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

@dataclass
class MatchResult:
    intent: str
    confidence: float
    extracted: dict
    plugin: str

@dataclass  
class CommandResult:
    success: bool
    action: str
    response_text: str
    data: dict

@dataclass
class IntentSpec:
    name: str
    description: str
    examples: list[str]
    slots: Optional[type[BaseModel]] = None  # pydantic model if it needs extracted params

class BaseCommand(ABC):
    name: str # e.g weather, tasks, etc.

    def get_intents(self) -> list[IntentSpec]: ...
    async def handle(self, intent: str, extracted: dict, raw: str) -> CommandResult: ...