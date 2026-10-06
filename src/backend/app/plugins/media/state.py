from dataclasses import dataclass

@dataclass
class MediaState:
    page_priority: int = 20  # Static priority - always visible
    dashboard_priority: int = 0  # Dynamic priority - 90 when playing, 0 otherwise
