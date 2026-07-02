from dataclasses import dataclass

@dataclass
class Page:
    id: str
    priority: int

@dataclass
class PagesState:
    pages: list[Page] = None