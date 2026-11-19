from dataclasses import dataclass
from typing import Any


@dataclass
class SpotifyState:
    connected: bool = False
    current: dict[str, Any] | None = None
    page_priority: int = 20
    dashboard_priority: int = 0