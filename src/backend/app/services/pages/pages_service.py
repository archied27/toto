from app.core.core import Core
from app.services.pages.pages_state import PagesState, Page

class PageService:
    def __init__(self, core: Core):
        self.core = core
        self.state = PagesState(pages=[])
        self.core.bus.on("pages.rerank", self.update_pages)
        self.core.scheduler.add_recurring("pages.rerank", minute="*/10") # rerank every 10 minutes

    async def update_pages(self) -> None:
        new_pages = PagesState(pages=[])

        active_plugins = [
            (plugin_id, getattr(data, "page_priority", 0))
            for plugin_id, data in self.core.state.get_all()
            if getattr(data, "page_priority", 0) != 0
        ]

        active_plugins.sort(key=lambda x:x[1], reverse=True)

        for plugin_id, priority in active_plugins:
            new_pages.pages.append(Page(id=plugin_id, priority=priority))

        await self.handle_rerank(new_pages)

    async def handle_rerank(self, new_state: PagesState) -> None:
        # slots have changed
        if new_state.pages != self.state.pages:
            self.state = new_state
            await self.core.state.set("pages", new_state)
            await self.core.bus.emit("pages.changed", self.state.pages)

    def get_state(self) -> PagesState:
        return self.state