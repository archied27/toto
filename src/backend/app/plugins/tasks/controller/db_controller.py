"""
handles all interaction with the database for the tasks plugin
"""

from typing import Optional

from app.core.core import Core
from app.plugins.tasks.schemas import Task, TaskList, Label, TasksState, CreateLabel, CreateTaskList, CreateTask


class TasksDBController:
    def __init__(self, core: Core):
        self.core = core

    async def create_tables(self):
        await self.core.db_manager.execute_many(
            """
            CREATE TABLE IF NOT EXISTS tasks_labels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                colour TEXT
            );

            CREATE TABLE IF NOT EXISTS tasks_list (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                colour TEXT
            );

            CREATE TABLE IF NOT EXISTS tasks_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                description TEXT,
                due_date TEXT,
                to_do_date TEXT,
                completed BOOLEAN,
                date_created TEXT,
                date_completed TEXT,
                list_id INTEGER,
                is_working BOOLEAN DEFAULT 0,
                time_spent INTEGER DEFAULT 0,
                work_session_start TEXT,
                pomodoro_goal INTEGER DEFAULT 1500
            );

            CREATE TABLE IF NOT EXISTS tasks_tasks_labels (
                task_id INTEGER,
                label_id INTEGER,
                PRIMARY KEY (task_id, label_id)
            );
            """
        )
        existing_columns = {
            row["name"]
            for row in await self.core.db_manager.fetch_all(
                "PRAGMA table_info(tasks_tasks)"
            )
        }
        columns = {
            "is_working": "BOOLEAN DEFAULT 0",
            "time_spent": "INTEGER DEFAULT 0",
            "work_session_start": "TEXT",
            "pomodoro_goal": "INTEGER DEFAULT 1500",
        }
        for name, definition in columns.items():
            if name not in existing_columns:
                await self.core.db_manager.execute(
                    f"ALTER TABLE tasks_tasks ADD COLUMN {name} {definition}"
                )

    # -------------------------------------------------------------------------
    # Labels
    # -------------------------------------------------------------------------

    async def add_label(self, label: CreateLabel):
        await self.core.db_manager.execute(
            "INSERT INTO tasks_labels (name, colour) VALUES (?, ?)",
            (label.name, label.colour)
        )

    async def get_labels(self) -> list[Label]:
        rows = await self.core.db_manager.fetch_all(
            "SELECT id, name, colour FROM tasks_labels"
        )
        return [Label(id=row["id"], name=row["name"], colour=row["colour"]) for row in rows]

    async def delete_label(self, label_id: int):
        await self.core.db_manager.execute(
            "DELETE FROM tasks_labels WHERE id = ?", (label_id,)
        )
        await self.core.db_manager.execute(
            "DELETE FROM tasks_tasks_labels WHERE label_id = ?", (label_id,)
        )

    async def edit_label(self, label_id: int, name: str, colour: str):
        await self.core.db_manager.execute(
            "UPDATE tasks_labels SET name = ?, colour = ? WHERE id = ?",
            (name, colour, label_id)
        )

    # -------------------------------------------------------------------------
    # Lists
    # -------------------------------------------------------------------------

    async def add_list(self, task_list: CreateTaskList):
        await self.core.db_manager.execute(
            "INSERT INTO tasks_list (name, colour) VALUES (?, ?)",
            (task_list.name, task_list.colour)
        )

    async def get_lists(self) -> list[TaskList]:
        rows = await self.core.db_manager.fetch_all(
            "SELECT id, name, colour FROM tasks_list"
        )
        return [TaskList(id=row["id"], name=row["name"], colour=row["colour"]) for row in rows]

    async def get_list(self, list_id: int) -> TaskList | None:
        row = await self.core.db_manager.fetch_one(
            "SELECT id, name, colour FROM tasks_list WHERE id = ?", (list_id,)
        )
        if not row:
            return None
        return TaskList(id=row["id"], name=row["name"], colour=row["colour"])

    async def delete_list(self, list_id: int):
        await self.core.db_manager.execute(
            "DELETE FROM tasks_list WHERE id = ?", (list_id,)
        )
        await self.core.db_manager.execute(
            "DELETE FROM tasks_tasks_lists WHERE list_id = ?", (list_id,)
        )

    async def edit_list(self, list_id: int, name: str, colour: str):
        await self.core.db_manager.execute(
            "UPDATE tasks_list SET name = ?, colour = ? WHERE id = ?",
            (name, colour, list_id)
        )

    # -------------------------------------------------------------------------
    # Tasks
    # -------------------------------------------------------------------------

    async def _fetch_labels_for_task(self, task_id: int) -> list[Label]:
        rows = await self.core.db_manager.fetch_all(
            """
            SELECT l.id, l.name, l.colour
            FROM tasks_labels l
            JOIN tasks_tasks_labels tl ON l.id = tl.label_id
            WHERE tl.task_id = ?
            """,
            (task_id,)
        )
        return [Label(id=row["id"], name=row["name"], colour=row["colour"]) for row in rows]

    async def _fetch_list_for_task(self, list_id: int) -> TaskList | None:
        row = await self.core.db_manager.fetch_one(
            "SELECT id, name, colour FROM tasks_list WHERE id = ?",
            (list_id,)
        )
        if not row:
            return None
        return TaskList(id=row["id"], name=row["name"], colour=row["colour"])

    def _build_task(self, row, labels: list[Label], task_list: TaskList | None) -> Task:
        return Task(
            id=row["id"],
            title=row["title"],
            description=row["description"],
            due_date=row["due_date"],
            to_do_date=row["to_do_date"],
            completed=row["completed"],
            date_created=row["date_created"],
            date_completed=row["date_completed"],
            labels=labels,
            task_list=task_list,
            is_working=bool(row["is_working"]),
            time_spent=row["time_spent"],
            work_session_start=row["work_session_start"],
            pomodoro_goal=row["pomodoro_goal"]
        )

    async def add_task(self, task: CreateTask):
        from datetime import datetime, timezone
        date_created = datetime.now(timezone.utc).isoformat()

        last_id = await self.core.db_manager.execute(
            """
            INSERT INTO tasks_tasks (title, description, due_date, to_do_date, completed, date_created, date_completed, list_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (task.title, task.description, task.due_date, task.to_do_date, False, date_created, None, task.list_id)
        )
        if task.label_ids:
            for label_id in task.label_ids:
                await self.core.db_manager.execute(
                    "INSERT INTO tasks_tasks_labels (task_id, label_id) VALUES (?, ?)",
                    (last_id, label_id)
                )

        return last_id

    async def get_task(self, task_id: int) -> Task | None:
        row = await self.core.db_manager.fetch_one(
            "SELECT * FROM tasks_tasks WHERE id = ?", (task_id,)
        )
        if not row:
            return None
        labels = await self._fetch_labels_for_task(task_id)
        task_list = await self._fetch_list_for_task(row["list_id"]) if row["list_id"] else None
        return self._build_task(row, labels, task_list)

    async def get_all_tasks(self) -> list[Task]:
        rows = await self.core.db_manager.fetch_all("SELECT * FROM tasks_tasks")
        tasks = []
        for row in rows:
            task_id = row["id"]
            labels = await self._fetch_labels_for_task(task_id)
            task_list = await self._fetch_list_for_task(row["list_id"]) if row["list_id"] else None
            tasks.append(self._build_task(row, labels, task_list))
        return tasks

    async def get_label_tasks(self, label_id: int) -> list[Task]:
        rows = await self.core.db_manager.fetch_all(
            """
            SELECT t.* FROM tasks_tasks t
            JOIN tasks_tasks_labels tl ON t.id = tl.task_id
            WHERE tl.label_id = ?
            """,
            (label_id,)
        )
        tasks = []
        for row in rows:
            task_id = row["id"]
            labels = await self._fetch_labels_for_task(task_id)
            task_list = await self._fetch_list_for_task(row["list_id"]) if row["list_id"] else None
            tasks.append(self._build_task(row, labels, task_list))
        return tasks

    async def get_list_tasks(self, list_id: int) -> list[Task]:
        rows = await self.core.db_manager.fetch_all(
            "SELECT * FROM tasks_tasks WHERE list_id = ?",
            (list_id,)
        )
        tasks = []
        for row in rows:
            task_id = row["id"]
            labels = await self._fetch_labels_for_task(task_id)
            task_list = await self._fetch_list_for_task(row["list_id"]) if row["list_id"] else None
            tasks.append(self._build_task(row, labels, task_list))
        return tasks

    async def update_task(self, task: CreateTask, id: int):
        await self.core.db_manager.execute(
            """
            UPDATE tasks_tasks
            SET title = ?, description = ?, due_date = ?, to_do_date = ?, list_id = ?
            WHERE id = ?
            """,
            (task.title, task.description, task.due_date, task.to_do_date,
             task.list_id if task.list_id else None, id)
        )
        await self.core.db_manager.execute(
            "DELETE FROM tasks_tasks_labels WHERE task_id = ?", (id,)
        )
        if task.label_ids:
            for label_id in task.label_ids:
                await self.core.db_manager.execute(
                    "INSERT INTO tasks_tasks_labels (task_id, label_id) VALUES (?, ?)",
                    (id, label_id)
                )

    # -------------------------------------------------------------------------
    # Work Session
    # -------------------------------------------------------------------------

    async def start_work(self, task_id: int):
        from datetime import datetime, timezone
        start_time = datetime.now(timezone.utc).isoformat()
        await self.core.db_manager.execute(
            "UPDATE tasks_tasks SET is_working = 1, work_session_start = ? WHERE id = ?",
            (start_time, task_id)
        )

    async def stop_work(self, task_id: int):
        from datetime import datetime, timezone
        # First, get the current work_session_start and the current time_spent
        row = await self.core.db_manager.fetch_one(
            "SELECT work_session_start, time_spent FROM tasks_tasks WHERE id = ?",
            (task_id,)
        )
        if not row or not row["work_session_start"]:
            # If there's no work session started, we just set is_working to 0 and leave time_spent as is?
            await self.core.db_manager.execute(
                "UPDATE tasks_tasks SET is_working = 0, work_session_start = NULL WHERE id = ?",
                (task_id,)
            )
            return

        start_time = datetime.fromisoformat(row["work_session_start"])
        now = datetime.now(timezone.utc)
        elapsed_seconds = int((now - start_time).total_seconds())

        new_time_spent = row["time_spent"] + elapsed_seconds

        await self.core.db_manager.execute(
            """
            UPDATE tasks_tasks
            SET is_working = 0,
                work_session_start = NULL,
                time_spent = ?
            WHERE id = ?
            """,
            (new_time_spent, task_id)
        )

    async def set_pomodoro_goal(self, task_id: int, goal_seconds: int):
        await self.core.db_manager.execute(
            "UPDATE tasks_tasks SET pomodoro_goal = ? WHERE id = ?",
            (goal_seconds, task_id)
        )

    async def delete_task(self, task_id: int):
        await self.core.db_manager.execute(
            "DELETE FROM tasks_tasks WHERE id = ?", (task_id,)
        )
        await self.core.db_manager.execute(
            "DELETE FROM tasks_tasks_labels WHERE task_id = ?", (task_id,)
        )
        await self.core.db_manager.execute(
            "DELETE FROM tasks_tasks_lists WHERE task_id = ?", (task_id,)
        )

    async def get_today_due_tasks(self) -> list[Task]:
        rows = await self.core.db_manager.fetch_all(
            "SELECT * FROM tasks_tasks WHERE due_date = date('now')"
        )
        tasks = []
        for row in rows:
            task_id = row["id"]
            labels = await self._fetch_labels_for_task(task_id)
            task_list = await self._fetch_list_for_task(row["list_id"]) if row["list_id"] else None
            tasks.append(self._build_task(row, labels, task_list))
        return tasks

    async def get_overdue_tasks(self) -> list[Task]:
        rows = await self.core.db_manager.fetch_all(
            "SELECT * FROM tasks_tasks WHERE (due_date < date('now') OR to_do_date < date('now')) AND completed = 0"
        )
        tasks = []
        for row in rows:
            task_id = row["id"]
            labels = await self._fetch_labels_for_task(task_id)
            task_list = await self._fetch_list_for_task(row["list_id"]) if row["list_id"] else None
            tasks.append(self._build_task(row, labels, task_list))
        return tasks

    async def get_todays_tasks(self) -> list[Task]:
        rows = await self.core.db_manager.fetch_all(
            "SELECT * FROM tasks_tasks WHERE to_do_date = date('now')"
        )
        tasks = []
        for row in rows:
            task_id = row["id"]
            labels = await self._fetch_labels_for_task(task_id)
            task_list = await self._fetch_list_for_task(row["list_id"]) if row["list_id"] else None
            tasks.append(self._build_task(row, labels, task_list))
        return tasks

    async def get_tomorrow_tasks(self) -> list[Task]:
        rows = await self.core.db_manager.fetch_all(
            "SELECT * FROM tasks_tasks WHERE to_do_date = date('now', '+1 day')"
        )
        tasks = []
        for row in rows:
            task_id = row["id"]
            labels = await self._fetch_labels_for_task(task_id)
            task_list = await self._fetch_list_for_task(row["list_id"]) if row["list_id"] else None
            tasks.append(self._build_task(row, labels, task_list))
        return tasks

    async def get_upcoming_tasks(self) -> list[Task]:
        rows = await self.core.db_manager.fetch_all(
            "SELECT * FROM tasks_tasks WHERE (due_date >= date('now') OR to_do_date >= date('now')) AND completed = 0"
        )
        tasks = []
        for row in rows:
            task_id = row["id"]
            labels = await self._fetch_labels_for_task(task_id)
            task_list = await self._fetch_list_for_task(row["list_id"]) if row["list_id"] else None
            tasks.append(self._build_task(row, labels, task_list))
        return tasks

    async def toggle_task_completion(self, task_id: int):
        from datetime import datetime, timezone

        row = await self.core.db_manager.fetch_one(
            "SELECT completed FROM tasks_tasks WHERE id = ?", (task_id,)
        )
        if not row:
            return
        new_status = not row["completed"]
        date_completed = datetime.now(timezone.utc).isoformat() if new_status else None

        await self.core.db_manager.execute(
            "UPDATE tasks_tasks SET completed = ?, date_completed = ? WHERE id = ?",
            (new_status, date_completed, task_id)
        )

    async def get_tasks_on_date(self, iso_date: str, date_type: str = "either") -> list[Task]:
        if date_type == "due":
            where, params = "due_date = ?", (iso_date,)
        elif date_type == "to_do":
            where, params = "to_do_date = ?", (iso_date,)
        else:
            where, params = "due_date = ? OR to_do_date = ?", (iso_date, iso_date)
        rows = await self.core.db_manager.fetch_all(
            f"SELECT * FROM tasks_tasks WHERE {where}", params
        )
        tasks = []
        for row in rows:
            labels = await self._fetch_labels_for_task(row["id"])
            task_list = await self._fetch_list_for_task(row["list_id"]) if row["list_id"] else None
            tasks.append(self._build_task(row, labels, task_list))
        return tasks

    async def get_tasks_between(self, start: str, end: str) -> list[Task]:
        rows = await self.core.db_manager.fetch_all(
            "SELECT * FROM tasks_tasks WHERE (due_date BETWEEN ? AND ?) OR (to_do_date BETWEEN ? AND ?)",
            (start, end, start, end),
        )
        tasks = []
        for row in rows:
            labels = await self._fetch_labels_for_task(row["id"])
            task_list = await self._fetch_list_for_task(row["list_id"]) if row["list_id"] else None
            tasks.append(self._build_task(row, labels, task_list))
        return tasks

    async def get_tasks_completed_on(self, iso_date: str) -> list[Task]:
        rows = await self.core.db_manager.fetch_all(
            "SELECT * FROM tasks_tasks WHERE completed = 1 AND substr(date_completed, 1, 10) = ?",
            (iso_date,),
        )
        tasks = []
        for row in rows:
            labels = await self._fetch_labels_for_task(row["id"])
            task_list = await self._fetch_list_for_task(row["list_id"]) if row["list_id"] else None
            tasks.append(self._build_task(row, labels, task_list))
        return tasks

    async def get_list_by_name(self, name: str) -> Optional[TaskList]:
        row = await self.core.db_manager.fetch_one(
            "SELECT id, name, colour FROM tasks_list WHERE lower(name) = lower(?)",
            (name,),
        )
        if not row:
            return None
        return TaskList(id=row["id"], name=row["name"], colour=row["colour"])

    async def get_label_by_name(self, name: str) -> Optional[Label]:
        row = await self.core.db_manager.fetch_one(
            "SELECT id, name, colour FROM tasks_labels WHERE lower(name) = lower(?)",
            (name,),
        )
        if not row:
            return None
        return Label(id=row["id"], name=row["name"], colour=row["colour"])