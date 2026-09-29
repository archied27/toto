import json
from datetime import datetime, timezone
from typing import Any

from app.core.core import Core
from app.plugins.habits.schemas import CreateHabit, Habit, UpdateHabit


class HabitsDBController:
    def __init__(self, core: Core):
        self.core = core

    async def create_tables(self):
        await self.core.db_manager.execute_many(
            """
            CREATE TABLE IF NOT EXISTS habits_habits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                colour TEXT,
                icon TEXT,
                schedule_type TEXT NOT NULL,
                schedule_config TEXT NOT NULL,
                start_date TEXT,
                end_date TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                paused_at TEXT,
                completed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS habits_completions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                habit_id INTEGER NOT NULL,
                occurrence_date TEXT NOT NULL,
                completed_at TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'api',
                note TEXT,
                UNIQUE(habit_id, occurrence_date),
                FOREIGN KEY(habit_id) REFERENCES habits_habits(id) ON DELETE CASCADE
            );
            """
        )

    @staticmethod
    def _to_habit(row: Any) -> Habit:
        return Habit(
            id=row["id"], name=row["name"], description=row["description"],
            colour=row["colour"], icon=row["icon"], schedule_type=row["schedule_type"],
            schedule_config=json.loads(row["schedule_config"]), start_date=row["start_date"],
            end_date=row["end_date"], status=row["status"], created_at=row["created_at"],
            updated_at=row["updated_at"], paused_at=row["paused_at"],
            completed_at=row["completed_at"],
        )

    async def add_habit(self, habit: CreateHabit, schedule_config: dict[str, Any],
                        start_date: str | None, end_date: str | None) -> int:
        now = datetime.now(timezone.utc).isoformat()
        return await self.core.db_manager.execute(
            """
            INSERT INTO habits_habits
            (name, description, colour, icon, schedule_type, schedule_config,
             start_date, end_date, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
            """,
            (habit.name, habit.description, habit.colour, habit.icon, habit.schedule_type,
             json.dumps(schedule_config), start_date, end_date, now, now),
        )

    async def get_habit(self, habit_id: int) -> Habit | None:
        row = await self.core.db_manager.fetch_one(
            "SELECT * FROM habits_habits WHERE id = ?", (habit_id,)
        )
        return self._to_habit(row) if row else None

    async def get_habits(self, include_inactive: bool = False) -> list[Habit]:
        query = "SELECT * FROM habits_habits"
        params: tuple = ()
        if not include_inactive:
            query += " WHERE status = 'active'"
        query += " ORDER BY status = 'active' DESC, name COLLATE NOCASE"
        rows = await self.core.db_manager.fetch_all(query, params)
        return [self._to_habit(row) for row in rows]

    async def update_habit(self, habit_id: int, values: dict[str, Any]):
        if not values:
            return
        values["updated_at"] = datetime.now(timezone.utc).isoformat()
        columns = ", ".join(f"{key} = ?" for key in values)
        params = [json.dumps(value) if key == "schedule_config" else value
                  for key, value in values.items()]
        params.append(habit_id)
        await self.core.db_manager.execute(
            f"UPDATE habits_habits SET {columns} WHERE id = ?", params
        )

    async def delete_habit(self, habit_id: int):
        await self.core.db_manager.execute(
            "DELETE FROM habits_completions WHERE habit_id = ?", (habit_id,)
        )
        await self.core.db_manager.execute(
            "DELETE FROM habits_habits WHERE id = ?", (habit_id,)
        )

    async def get_completions(self, habit_id: int, start_date: str, end_date: str) -> dict[str, str]:
        rows = await self.core.db_manager.fetch_all(
            """
            SELECT occurrence_date, completed_at FROM habits_completions
            WHERE habit_id = ? AND occurrence_date BETWEEN ? AND ?
            ORDER BY occurrence_date
            """,
            (habit_id, start_date, end_date),
        )
        return {row["occurrence_date"]: row["completed_at"] for row in rows}

    async def complete(self, habit_id: int, occurrence_date: str, source: str):
        completed_at = datetime.now(timezone.utc).isoformat()
        await self.core.db_manager.execute(
            """
            INSERT INTO habits_completions (habit_id, occurrence_date, completed_at, source)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(habit_id, occurrence_date) DO UPDATE SET
                completed_at = excluded.completed_at, source = excluded.source
            """,
            (habit_id, occurrence_date, completed_at, source),
        )

    async def undo(self, habit_id: int, occurrence_date: str):
        await self.core.db_manager.execute(
            "DELETE FROM habits_completions WHERE habit_id = ? AND occurrence_date = ?",
            (habit_id, occurrence_date),
        )

    async def find_by_name(self, name: str, active_only: bool = True) -> list[Habit]:
        query = "SELECT * FROM habits_habits WHERE name LIKE ? COLLATE NOCASE"
        params: list[Any] = [f"%{name.strip()}%"]
        if active_only:
            query += " AND status = 'active'"
        query += " ORDER BY LENGTH(name), name COLLATE NOCASE"
        rows = await self.core.db_manager.fetch_all(query, params)
        return [self._to_habit(row) for row in rows]
