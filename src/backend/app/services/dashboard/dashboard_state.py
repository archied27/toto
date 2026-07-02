from dataclasses import dataclass, field
from datetime import datetime, UTC

@dataclass
class DashboardSlot:
    id: str | None = None
    priority: int = 0

@dataclass
class DashboardState:
    hero: DashboardSlot = field(default_factory=DashboardSlot)
    long: DashboardSlot = field(default_factory=DashboardSlot)
    small_a: DashboardSlot = field(default_factory=DashboardSlot)
    small_b: DashboardSlot = field(default_factory=DashboardSlot)

    last_ranked: datetime | None = None

    @property
    def slots(self):
        return {
            "hero": {"id": self.hero.id, "priority": self.hero.priority},
            "long": {"id": self.long.id, "priority": self.long.priority},
            "small_a": {"id": self.small_a.id, "priority": self.small_a.priority},
            "small_b": {"id": self.small_b.id, "priority": self.small_b.priority},   
        }