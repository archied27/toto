import math
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable

from app.core.core import Core
from app.plugins.tasks.controller.db_controller import TasksDBController


class PomodoroController:
    SHORT_BREAK_SECONDS = 5 * 60
    LONG_BREAK_SECONDS = 15 * 60

    def __init__(
        self,
        core: Core,
        db_controller: TasksDBController,
        update_state: Callable[[], Awaitable[None]],
    ):
        self.core = core
        self.db_controller = db_controller
        self.update_state = update_state

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    def _parse_time(value: str | None) -> datetime | None:
        if not value:
            return None
        parsed = datetime.fromisoformat(value)
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed

    @staticmethod
    def _live_focus_seconds(task: Any, now: datetime | None = None) -> int:
        start = PomodoroController._parse_time(task["work_session_start"])
        if not start:
            return 0
        return max(0, math.floor(((now or PomodoroController._now()) - start).total_seconds()))

    async def _get_task(self, task_id: int):
        return await self.core.db_manager.fetch_one(
            """SELECT id, title, is_working, is_paused, session_elapsed,
                      work_session_start, pomodoro_goal, pomodoro_active,
                      pomodoro_phase, pomodoro_focus_elapsed,
                      pomodoro_break_ends_at, pomodoro_break_remaining,
                      pomodoro_completed_sessions
               FROM tasks_tasks WHERE id = ?""",
            (task_id,),
        )

    async def _save_state(
        self,
        task_id: int,
        *,
        active: bool,
        phase: str = "focus",
        focus_elapsed: int = 0,
        break_ends_at: str | None = None,
        break_remaining: int | None = None,
        completed_sessions: int = 0,
    ) -> None:
        if break_remaining is None:
            break_remaining = self.SHORT_BREAK_SECONDS

        await self.core.db_manager.execute(
            """UPDATE tasks_tasks
               SET pomodoro_active = ?, pomodoro_phase = ?,
                   pomodoro_focus_elapsed = ?, pomodoro_break_ends_at = ?,
                   pomodoro_break_remaining = ?, pomodoro_completed_sessions = ?
               WHERE id = ?""",
            (
                int(active), phase, max(0, focus_elapsed), break_ends_at,
                max(0, break_remaining), max(0, completed_sessions), task_id,
            ),
        )

    def _cancel_job(self, task_id: int) -> None:
        self.core.scheduler.remove_job(f"tasks-pomodoro-{task_id}")

    async def _schedule(self, task_id: int) -> None:
        self._cancel_job(task_id)
        task = await self._get_task(task_id)
        if not task or not task["pomodoro_active"]:
            return

        if task["pomodoro_phase"] == "break":
            run_at = self._parse_time(task["pomodoro_break_ends_at"])
            if run_at:
                self.core.scheduler.scheduler.add_job(
                    self._on_deadline,
                    trigger="date",
                    next_run_time=run_at,
                    id=f"tasks-pomodoro-{task_id}",
                    replace_existing=True,
                    args=[task_id],
                )
            return

        if not task["is_working"]:
            return
        elapsed = task["pomodoro_focus_elapsed"] + self._live_focus_seconds(task)
        remaining = max(0, task["pomodoro_goal"] - elapsed)
        self.core.scheduler.scheduler.add_job(
            self._on_deadline,
            trigger="date",
            next_run_time=self._now() + timedelta(seconds=remaining),
            id=f"tasks-pomodoro-{task_id}",
            replace_existing=True,
            args=[task_id],
        )

    async def restore_active_timers(self) -> None:
        rows = await self.core.db_manager.fetch_all(
            "SELECT id FROM tasks_tasks WHERE pomodoro_active = 1"
        )
        for row in rows:
            await self._schedule(row["id"])

    async def start(self, task_id: int, reset_session: bool = False) -> None:
        task = await self._get_task(task_id)
        if not task:
            return

        if task["pomodoro_active"] and not reset_session:
            if task["pomodoro_phase"] == "break":
                if not task["pomodoro_break_ends_at"]:
                    remaining = task["pomodoro_break_remaining"] or self.SHORT_BREAK_SECONDS
                    ends_at = self._now() + timedelta(seconds=remaining)
                    await self._save_state(
                        task_id,
                        active=True,
                        phase="break",
                        focus_elapsed=task["pomodoro_focus_elapsed"],
                        break_ends_at=ends_at.isoformat(),
                        break_remaining=remaining,
                        completed_sessions=task["pomodoro_completed_sessions"],
                    )
            else:
                if not task["is_working"]:
                    await self.db_controller.start_work(task_id)
        else:
            await self.db_controller.start_work(task_id, reset_session)
            await self._save_state(
                task_id,
                active=True,
                phase="focus",
                focus_elapsed=0,
                completed_sessions=0,
            )

        await self._schedule(task_id)
        await self.update_state()

    async def pause(self, task_id: int) -> None:
        task = await self._get_task(task_id)
        if not task or not task["pomodoro_active"]:
            await self.db_controller.pause_work(task_id)
            await self.update_state()
            return

        self._cancel_job(task_id)
        if task["pomodoro_phase"] == "break":
            ends_at = self._parse_time(task["pomodoro_break_ends_at"])
            remaining = (
                max(0, math.ceil((ends_at - self._now()).total_seconds()))
                if ends_at else task["pomodoro_break_remaining"]
            )
            await self._save_state(
                task_id,
                active=True,
                phase="break",
                focus_elapsed=task["pomodoro_focus_elapsed"],
                break_remaining=remaining,
                completed_sessions=task["pomodoro_completed_sessions"],
            )
        elif task["is_working"]:
            focus_elapsed = task["pomodoro_focus_elapsed"] + self._live_focus_seconds(task)
            await self.db_controller.pause_work(task_id)
            await self._save_state(
                task_id,
                active=True,
                phase="focus",
                focus_elapsed=focus_elapsed,
                completed_sessions=task["pomodoro_completed_sessions"],
            )
        await self.update_state()

    async def stop(self, task_id: int) -> None:
        self._cancel_job(task_id)
        await self.db_controller.stop_work(task_id)
        await self._save_state(task_id, active=False)
        await self.update_state()

    async def skip_to_break(self, task_id: int) -> None:
        task = await self._get_task(task_id)
        if not task or not task["pomodoro_active"] or task["pomodoro_phase"] != "focus":
            return
        if task["is_working"]:
            focus_elapsed = task["pomodoro_focus_elapsed"] + self._live_focus_seconds(task)
            await self.db_controller.pause_work(task_id)
        else:
            focus_elapsed = task["pomodoro_focus_elapsed"]
        await self._begin_break(task, focus_elapsed)

    async def skip_break(self, task_id: int) -> None:
        task = await self._get_task(task_id)
        if not task or not task["pomodoro_active"] or task["pomodoro_phase"] != "break":
            return
        await self._begin_focus(task)

    async def _begin_break(self, task: Any, focus_elapsed: int) -> None:
        task_id = task["id"]
        self._cancel_job(task_id)
        completed = task["pomodoro_completed_sessions"] + 1
        duration = self.LONG_BREAK_SECONDS if completed % 4 == 0 else self.SHORT_BREAK_SECONDS
        ends_at = self._now() + timedelta(seconds=duration)
        await self._save_state(
            task_id,
            active=True,
            phase="break",
            focus_elapsed=focus_elapsed,
            break_ends_at=ends_at.isoformat(),
            break_remaining=duration,
            completed_sessions=completed,
        )
        await self._send_notification(
            "Break Time!", f"{task['title']}: take a {duration // 60}-minute break.",
            f"pomodoro-{task_id}-break",
        )
        await self._schedule(task_id)
        await self.update_state()

    async def _begin_focus(self, task: Any) -> None:
        task_id = task["id"]
        self._cancel_job(task_id)
        await self.db_controller.start_work(task_id)
        await self._save_state(
            task_id,
            active=True,
            phase="focus",
            focus_elapsed=0,
            completed_sessions=task["pomodoro_completed_sessions"],
        )
        await self._send_notification(
            "Focus Time!", f"Break is over. Back to {task['title']}!",
            f"pomodoro-{task_id}-focus",
        )
        await self._schedule(task_id)
        await self.update_state()

    async def _on_deadline(self, task_id: int) -> None:
        task = await self._get_task(task_id)
        if not task or not task["pomodoro_active"]:
            return

        if task["pomodoro_phase"] == "focus":
            elapsed = task["pomodoro_focus_elapsed"] + self._live_focus_seconds(task)
            if elapsed < task["pomodoro_goal"] or not task["is_working"]:
                await self._schedule(task_id)
                return
            await self.db_controller.pause_work(task_id)
            await self._begin_break(task, elapsed)
            return

        ends_at = self._parse_time(task["pomodoro_break_ends_at"])
        if not ends_at or ends_at > self._now():
            await self._schedule(task_id)
            return
        await self._begin_focus(task)

    async def _send_notification(self, title: str, body: str, tag: str) -> None:
        notifications = getattr(self.core, "push_notifications", None)
        if notifications:
            await notifications.send(title, body, "/", tag)