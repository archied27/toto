"""
contains logic for web plugin
"""

import asyncio

from ddgs import DDGS
SNIPPET_CAP = 200

class WebController:
    async def search(self, query: str, max_results: int = 10) -> list[dict]:
        # DDGS.text() is synchronous — run it off the event loop so a slow
        # search doesn't block the whole server.
        return await asyncio.to_thread(self._run_search, query, max_results)

    
    @staticmethod
    def _run_search(query: str, max_results: int) -> list[dict]:
        return [
            {
                "title": r["title"],
                "url": r["href"],
                "snippet": r["body"][:SNIPPET_CAP].rsplit(" ", 1)[0] + "…"
                        if len(r["body"]) > SNIPPET_CAP else r["body"],
            }
            for r in DDGS().text(query, max_results=max_results)
        ]