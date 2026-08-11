from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal, Optional
from pydantic import BaseModel

@dataclass
class MatchResult:
    intent: str
    confidence: float
    extracted: dict
    plugin: str
    intent_name: Optional[str] = None # for if confirmation is needed

@dataclass  
class CommandResult:
    success: bool
    action: str
    response_text: str
    data: dict

@dataclass
class IntentSpec:
    name: str
    command_name: str # used for confirmation e.g "Add A New Task" or "Show Tomorrow's Tasks"
    description: str
    type: Literal["nav", "read", "write"]
    examples: list[str]
    slots: Optional[type[BaseModel]] = None  # pydantic model if it needs extracted params
    slot_examples: Optional[list[tuple[str, dict]]] = None  # (example input, expected extracted dict)
    loading_msg: Optional[str] = None  # message to show while processing, if any

class BaseCommand(ABC):
    name: str # e.g weather, tasks, etc.

    def get_intents(self) -> list[IntentSpec]: ...

    def get_intent(self, intent_name: str) -> Optional[IntentSpec]:
        """Find an intent by name, or None if this plugin doesn't own it."""
        for intent in self.get_intents():
            if intent.name == intent_name:
                return intent
        return None

    async def handle(self, intent: str, extracted: dict, raw: str) -> CommandResult: ...