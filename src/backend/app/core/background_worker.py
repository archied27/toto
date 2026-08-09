"""
worker to run long tasks in the background
"""

from __future__ import annotations
from asyncio.queues import Queue
import asyncio
from typing import Callable, Any
import inspect
from app.core.event_bus import EventBus

class BackgroundWorker:
    def __init__(self, event_bus: EventBus):
        self.queue = Queue()
        self.event_bus = event_bus
        self.handlers = {}
        self.next_id = 0
        self.running = False

    async def add_task(self, task_type: str, data: Any = None):
        """
        adds task to the queue
        """
        task = Task(self.next_id, task_type, self.event_bus, data)

        self.next_id += 1

        await self.queue.put(task)

        return task.id

    def register_handler(self, task_type: str, handler: Callable):
        """
        registers new handler to be performed when task_type is added to the queue
        handlers must take task object in
        """
        self.handlers[task_type] = handler

    async def start(self):
        """
        starts background worker running
        """

        self.running = True

        while self.running:
            current_task = await self.queue.get()

            try:
                await self.execute_task(current_task)
            finally:
                self.queue.task_done()

    def stop(self):
        """
        stops background worker
        """
        self.running = False

    async def execute_task(self, task: Task):
        """
        executes task
        """
        task.status = "running"

        await self.event_bus.emit("task.started", task)

        handler = self.handlers.get(task.type)

        if not handler:
            task.status = "failed"
            task.message = f"No handler for {task.type}"
            return

        try:
            # async
            if inspect.iscoroutinefunction(handler):
                await handler(task)
            # normal
            else:
                await asyncio.to_thread(handler, task)

            task.status = "completed"

            await self.event_bus.emit("task.completed", task)

        except Exception as e:
            task.status = "failed"
            task.error = str(e)
            await self.event_bus.emit("task.failed", task)

class Task:
    def __init__(self, id: int, task_type: str, event_bus: EventBus, data: Any = None):
        self.id = id
        self.type = task_type
        self.data = data
        self.status = "pending"
        self.progress = 0.0
        self.message = None
        self.bus = event_bus

    async def update(self, progress: float, message: str):
        self.progress = progress
        self.message = message
        await self.bus.emit("task.progress", self)