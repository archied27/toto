"""
handles all interaction with the database for the tasks plugin
"""

from typing import Optional

from app.core.core import Core
from app.plugins.tasks.schemas import Task, TaskList, Label, TasksState, WorkSession, CreateLabel, CreateTaskList, CreateTask


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
                is_paused BOOLEAN DEFAULT 0,
                session_elapsed INTEGER DEFAULT 0,
                time_spent INTEGER DEFAULT 0,
                work_session_start TEXT,
                session_started_at TEXT,
                pomodoro_goal INTEGER DEFAULT 1500
            );

            CREATE TABLE IF NOT EXISTS tasks_tasks_labels (
                task_id INTEGER,
                label_id INTEGER,
                PRIMARY KEY (task_id, label_id)
            );

            CREATE TABLE IF NOT EXISTS tasks_work_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                started_at TEXT NOT NULL,
                ended_at TEXT NOT NULL,
                duration_seconds INTEGER NOT NULL
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
            "is_paused": "BOOLEAN DEFAULT 0",
            "session_elapsed": "INTEGER DEFAULT 0",
            "time_spent": "INTEGER DEFAULT 0",
            "work_session_start": "TEXT",
            "session_started_at": "TEXT",
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
            is_paused=bool(row["is_paused"]),
            session_elapsed=row["session_elapsed"],
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

    async def _record_work_session(self, task_id: int, started_at: str | None, duration_seconds: int, ended_at: str):
        if duration_seconds <= 0:
            return
        from datetime import datetime, timedelta, timezone
        end = datetime.fromisoformat(ended_at)
        start = datetime.fromisoformat(started_at) if started_at else end - timedelta(seconds=duration_seconds)
        await self.core.db_manager.execute(
            """
            INSERT INTO tasks_work_sessions (task_id, started_at, ended_at, duration_seconds)
            VALUES (?, ?, ?, ?)
            """,
            (task_id, start.isoformat(), end.isoformat(), duration_seconds),
        )

    async def get_task_sessions(self, task_id: int) -> list[WorkSession]:
        rows = await self.core.db_manager.fetch_all(
            """
            SELECT id, task_id, started_at, ended_at, duration_seconds
            FROM tasks_work_sessions
            WHERE task_id = ?
            ORDER BY started_at DESC
            """,
            (task_id,),
        )
        return [WorkSession(**dict(row)) for row in rows]

    async def start_work(self, task_id: int, reset_session: bool = False):
        from datetime import datetime, timezone
        start_time = datetime.now(timezone.utc).isoformat()
        await self.core.db_manager.execute(
            """
            UPDATE tasks_tasks
            SET is_working = 1,
                is_paused = 0,
                session_elapsed = CASE WHEN ? THEN 0 ELSE session_elapsed END,
                work_session_start = ?,
                session_started_at = CASE
                    WHEN ? OR session_started_at IS NULL THEN ?
                    ELSE session_started_at
                END
            WHERE id = ? AND (is_paused = 1 OR is_working = 0 OR ? = 1)
            """,
            (
                int(reset_session),
                start_time,
                int(reset_session),
                start_time,
                task_id,
                int(reset_session),
            ),
        )

    async def stop_work(self, task_id: int):
        from datetime import datetime, timezone
        # First, get the current work_session_start, time_spent, and session_elapsed
        row = await self.core.db_manager.fetch_one(
            "SELECT work_session_start, session_started_at, time_spent, session_elapsed FROM tasks_tasks WHERE id = ?",
            (task_id,)
        )
        if not row:
            return

        now = datetime.now(timezone.utc)
        elapsed_seconds = 0
        if row["work_session_start"]:
            start_time = datetime.fromisoformat(row["work_session_start"])
            elapsed_seconds = int((now - start_time).total_seconds())

        session_duration = row["session_elapsed"] + elapsed_seconds
        session_started_at = row["session_started_at"] or row["work_session_start"]
        await self._record_work_session(task_id, session_started_at, session_duration, now.isoformat())

        new_time_spent = row["time_spent"] + session_duration
        await self.core.db_manager.execute(
            """
            UPDATE tasks_tasks
            SET is_working = 0,
                is_paused = 0,
                session_elapsed = 0,
                work_session_start = NULL,
                session_started_at = NULL,
                time_spent = ?
            WHERE id = ?
            """,
            (new_time_spent, task_id)
        )

    async def reset_work(self, task_id: int):
        await self.core.db_manager.execute(
            """
            UPDATE tasks_tasks
            SET is_working = 0,
                is_paused = 0,
                session_elapsed = 0,
                work_session_start = NULL,
                session_started_at = NULL,
                time_spent = 0
            WHERE id = ?
            """,
            (task_id,)
        )
        await self.core.db_manager.execute(
            "DELETE FROM tasks_work_sessions WHERE task_id = ?", (task_id,)
        )

    async def pause_work(self, task_id: int):
        from datetime import datetime, timezone
        # First, get the current work_session_start, time_spent, and session_elapsed
        row = await self.core.db_manager.fetch_one(
            "SELECT work_session_start, session_elapsed FROM tasks_tasks WHERE id = ?",
            (task_id,)
        )
        if not row or not row["work_session_start"]:
            # If there's no work session started, just return
            return

        start_time = datetime.fromisoformat(row["work_session_start"])
        now = datetime.now(timezone.utc)
        elapsed_seconds = int((now - start_time).total_seconds())

        # Pausing preserves the current session; stop_work finalizes it.
        new_session_elapsed = row["session_elapsed"] + elapsed_seconds
        await self.core.db_manager.execute(
            """
            UPDATE tasks_tasks
            SET is_working = 0,
                is_paused = 1,
                session_elapsed = ?,
                work_session_start = NULL
            WHERE id = ?
            """,
            (new_session_elapsed, task_id)
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