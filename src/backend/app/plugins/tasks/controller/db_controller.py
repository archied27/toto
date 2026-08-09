"""
handles all interaction with the database for the tasks plugin
"""

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
                list_id INTEGER
            );

            CREATE TABLE IF NOT EXISTS tasks_tasks_labels (
                task_id INTEGER,
                label_id INTEGER,
                PRIMARY KEY (task_id, label_id)
            );
            """
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
            task_list=task_list
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

    async def get_tasks_with_a_due_date(self) -> list[Task]:
        rows = await self.core.db_manager.fetch_all(
            "SELECT * FROM tasks_tasks WHERE due_date IS NOT NULL"
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