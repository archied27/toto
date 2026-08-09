from pydantic import BaseModel, Field
from typing import Optional

class CreateLabel(BaseModel):
    name: str
    colour: str

class CreateTaskList(BaseModel):
    name: str
    colour: str

class CreateTask(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = None
    to_do_date: Optional[str] = None
    label_ids: Optional[list[int]] = Field(default_factory=list)
    list_id: Optional[int] = None

class Label(BaseModel):
    id: int
    name: str
    colour: str

class TaskList(BaseModel):
    id: int
    name: str
    colour: str

class Task(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = None
    to_do_date: Optional[str] = None
    completed: bool = False
    date_created: Optional[str] = None
    date_completed: Optional[str] = None
    labels: list[Label] = Field(default_factory=list)
    task_list: Optional[TaskList] = None

TaskList.model_rebuild()

class TasksState(BaseModel):
    dashboard_priority: int = 0
    page_priority: int = 50
    base_priority: int = 50
    overdue_tasks: list[Task] = Field(default_factory=list)
    today_tasks: list[Task] = Field(default_factory=list)
    tasks_due_today: list[Task] = Field(default_factory=list)