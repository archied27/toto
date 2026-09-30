from dataclasses import dataclass

@dataclass
class MediaState:
    page_priority: int = 20  # Static priority - always visible
