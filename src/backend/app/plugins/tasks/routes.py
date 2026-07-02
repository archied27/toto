"""
endpoints for tasks plugin
"""

from fastapi import APIRouter
from app.plugins.tasks.controller.controller import TasksController
from app.plugins.tasks.schemas import Task, TaskList, Label, TasksState, CreateLabel, CreateTaskList, CreateTask

class TasksRouter:
    def __init__(self, controller: TasksController):
        self.router = APIRouter()
        self.controller = controller

        self.router.add_api_route("/add_task", self.add_task, methods=["POST"])
        self.router.add_api_route("/state", self.get_state, methods=["GET"])
        self.router.add_api_route("/delete_task/{task_id}", self.delete_task, methods=["DELETE"])
        self.router.add_api_route("/update_task", self.update_task, methods=["PUT"])
        self.router.add_api_route("/get_task/{task_id}", self.get_task, methods=["GET"])
        self.router.add_api_route("/get_all_tasks", self.get_all_tasks, methods=["GET"])
        self.router.add_api_route("/add_label", self.add_label, methods=["POST"])
        self.router.add_api_route("/get_labels", self.get_labels, methods=["GET"])
        self.router.add_api_route("/get_label_tasks/{label_id}", self.get_label_tasks, methods=["GET"])
        self.router.add_api_route("/add_list", self.add_list, methods=["POST"])
        self.router.add_api_route("/get_list/{list_id}", self.get_list, methods=["GET"])
        self.router.add_api_route("/get_lists", self.get_lists, methods=["GET"])
        self.router.add_api_route("/delete_list/{list_id}", self.delete_list, methods=["DELETE"])
        self.router.add_api_route("/delete_label/{label_id}", self.delete_label, methods=["DELETE"])
        self.router.add_api_route("/edit_label", self.edit_label, methods=["PUT"])
        self.router.add_api_route("/edit_list", self.edit_list, methods=["PUT"])
        self.router.add_api_route("/get_tomorrow_tasks", self.get_tomorrow_tasks, methods=["GET"])
        self.router.add_api_route("/get_upcoming_tasks", self.get_upcoming_tasks, methods=["GET"])
        self.router.add_api_route("/toggle_task_completion/{task_id}", self.toggle_task_completion, methods=["PUT"])
        
    async def add_task(self, task: CreateTask):
        await self.controller.add_task(task)
        return {"message": "Task added successfully"}

    async def get_state(self):
        state = await self.controller.get_state()
        return state

    async def delete_task(self, task_id: str):
        await self.controller.delete_task(task_id)
        return {"message": "Task deleted successfully"}

    async def update_task(self, task: CreateTask, id: int):
        await self.controller.update_task(task, id)
        return {"message": "Task updated successfully"}

    async def get_task(self, task_id: str):
        task = await self.controller.get_task(task_id)
        return task

    async def get_all_tasks(self):
        tasks = await self.controller.get_all_tasks()
        return tasks

    async def add_list(self, task_list: CreateTaskList):
        await self.controller.add_list(task_list)
        return {"message": "Task list added successfully"}

    async def get_list(self, list_id: str):
        task_list = await self.controller.get_list(list_id)
        return task_list

    async def add_label(self, label: CreateLabel):
        await self.controller.add_label(label)
        return {"message": "Label added successfully"}

    async def get_labels(self):
        labels = await self.controller.get_labels()
        return labels
    
    async def get_label_tasks(self, label_id: str):
        tasks = await self.controller.get_label_tasks(label_id)
        return tasks

    async def get_lists(self):
        lists = await self.controller.get_lists()
        return lists

    async def delete_list(self, list_id: str):
        await self.controller.delete_list(list_id)
        return {"message": "Task list deleted successfully"}

    async def delete_label(self, label_id: str):
        await self.controller.delete_label(label_id)
        return {"message": "Label deleted successfully"}

    async def edit_label(self, body: Label):
        await self.controller.edit_label(body.id, body.name, body.colour)
        return {"message": "Label edited successfully"}

    async def edit_list(self, body: TaskList):
        await self.controller.edit_list(body.id, body.name, body.colour)
        return {"message": "Task list edited successfully"}

    async def get_tomorrow_tasks(self):
        tasks = await self.controller.get_tomorrow_tasks()
        return tasks

    async def get_upcoming_tasks(self):
        tasks = await self.controller.get_upcoming_tasks()
        return tasks

    async def toggle_task_completion(self, task_id: str):
        await self.controller.toggle_task_completion(task_id)
        return {"message": "Task completion toggled successfully"}