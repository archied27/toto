"""
handles websocket connections
"""

from fastapi import WebSocket
import json
import asyncio
from typing import Any, Set, Dict
from app.core.event_bus import EventBus

class WebSocketManager:
    def __init__(self, event_bus: EventBus):
        self.connections: Set = set()
        self.lock = asyncio.Lock()
        self.event_bus = event_bus

    async def connect(self, websocket: WebSocket):
        """
        connects websocket and adds to connections
        """
        await websocket.accept()
        async with self.lock:
            self.connections.add(websocket)

    async def disconnect(self, websocket: WebSocket):
        """
        removes websocket from connections
        """
        print("\n\n\n\n\n\n\n\n\n")
        print(f"Disconnecting websocket: {websocket.client}")
        print("\n\n\n\n\n\n\n\n\n")
        async with self.lock:
            if websocket in self.connections:
                self.connections.remove(websocket)

    async def send(self, websocket: WebSocket, message: Dict[str, Any]):
        """
        sends data through websocket to one client with format {type: str, data: any}
        disconnects client if can't send
        """
        try:
            await websocket.send_text(json.dumps(message))
        except:
            await self.disconnect(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        """
        sends data to all clients connected
        removes all which cannot send to
        """
        async with self.lock:
            connections = list(self.connections)

        dead = []
        for ws in connections:
            try:
                await ws.send_text(json.dumps(message))
                print(f"\n\nMessage sent {message}")
            except Exception as e:
                print(f"send failed: {e}")
                dead.append(ws)

        for ws in dead:
            await self.disconnect(ws)

    async def forward(self, event: str):
        """
        forwards an event bus event to all websocket clients
        """
        async def handler(data):
            await self.broadcast({"type": event, "data": data})
        self.event_bus.on(event, handler)

    async def forward_many(self, events: list[str]):
        """
        forwards multiple event bus events to all websocket clients
        """
        for event in events:
            await self.forward(event)
