from dataclasses import dataclass

@dataclass
class MPVState:
    dashboard_priority: int = 0
    page_priority: int = 50
    base_priority: int = 50