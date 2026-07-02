from app.core.core import Core
from app.services.dashboard.dashboard_state import DashboardState
from datetime import datetime, UTC

class DashboardService:
    def __init__(self, core: Core):
        self.core = core
        self.dashboard_state = DashboardState()
        self.core.bus.on("dashboard.rerank", self.rerank)
        self.core.scheduler.add_recurring("dashboard.rerank", minute="*/1") # rerank every minute 

    async def rerank(self) -> None:
        new_state = DashboardState()

        active_plugins = [
            (plugin_id, getattr(data, "dashboard_priority", 0))
            for plugin_id, data in self.core.state.get_all()
            if getattr(data, "dashboard_priority", 0) != 0
        ]
        
        active_plugins.sort(key=lambda x:x[1], reverse=True)

        # Assign the top 4 plugins to the dashboard slots
        new_state.hero.id = active_plugins[0][0] if len(active_plugins) > 0 else None
        new_state.hero.priority = active_plugins[0][1] if len(active_plugins) > 0 else 0
        new_state.long.id = active_plugins[1][0] if len(active_plugins) > 1 else None
        new_state.long.priority = active_plugins[1][1] if len(active_plugins) > 1 else 0
        new_state.small_a.id = active_plugins[2][0] if len(active_plugins) > 2 else None
        new_state.small_a.priority = active_plugins[2][1] if len(active_plugins) > 2 else 0
        new_state.small_b.id = active_plugins[3][0] if len(active_plugins)  > 3 else None
        new_state.small_b.priority = active_plugins[3][1] if len(active_plugins) > 3 else 0

        new_state.last_ranked = datetime.now(UTC)
        await self.handle_rerank(new_state)

        
    async def handle_rerank(self, new_state: DashboardState) -> None:
        # slots have changed
        if new_state.slots != self.dashboard_state.slots:
            self.dashboard_state = new_state
            print(f"Dashboard slots updated: {new_state.slots}")
            await self.core.state.set("dashboard", new_state)
            await self.core.bus.emit("dashboard.changed", new_state.slots)

    def get_state(self) -> DashboardState:
        return self.dashboard_state
            
        