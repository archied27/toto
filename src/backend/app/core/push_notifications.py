import asyncio
import json
import os
from datetime import datetime
from typing import Any


class PushNotificationService:
    """General server-side Web Push service for installed PWA clients."""

    def __init__(self, db_manager, scheduler):
        self.db = db_manager
        self.scheduler = scheduler
        self._jobs: dict[str, str] = {}

    async def setup(self) -> None:
        await self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS notification_push_subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                endpoint TEXT NOT NULL UNIQUE,
                p256dh TEXT NOT NULL,
                auth TEXT NOT NULL,
                user_agent TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

    def public_key(self) -> str:
        return os.getenv("VAPID_PUBLIC_KEY", "")

    def private_key(self) -> str:
        value = os.getenv("VAPID_PRIVATE_KEY", "")
        candidate_paths = [value]
        if value:
            candidate_paths.append(os.path.join("/app/data", os.path.basename(value)))
        key_path = next((path for path in candidate_paths if path and os.path.isfile(path)), None)
        if key_path:
            return key_path
        return value

    async def subscribe(self, subscription: dict[str, Any], user_agent: str = "") -> bool:
        endpoint = subscription.get("endpoint")
        keys = subscription.get("keys", {})
        p256dh = keys.get("p256dh")
        auth = keys.get("auth")
        if not endpoint or not p256dh or not auth:
            raise ValueError("Invalid push subscription")

        now = datetime.utcnow().isoformat()
        await self.db.execute(
            """
            INSERT INTO notification_push_subscriptions
                (endpoint, p256dh, auth, user_agent, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(endpoint) DO UPDATE SET
                p256dh = excluded.p256dh,
                auth = excluded.auth,
                user_agent = excluded.user_agent,
                updated_at = excluded.updated_at
            """,
            [endpoint, p256dh, auth, user_agent, now, now],
        )
        return True

    async def unsubscribe(self, endpoint: str) -> bool:
        await self.db.execute(
            "DELETE FROM notification_push_subscriptions WHERE endpoint = ?",
            [endpoint],
        )
        return True

    async def send(self, title: str, body: str = "", url: str = "/", tag: str | None = None) -> dict[str, Any]:
        private_key = self.private_key()
        if not self.public_key() or not private_key:
            return {"sent": 0, "attempted": 0, "failed": 0, "error": "VAPID keys are not configured"}

        subscriptions = await self.db.fetch_all(
            "SELECT endpoint, p256dh, auth FROM notification_push_subscriptions"
        )
        if not subscriptions:
            return {"sent": 0, "attempted": 0, "failed": 0, "error": "No push subscriptions are registered"}

        payload = json.dumps({
            "title": title,
            "body": body,
            "url": url,
            "tag": tag,
        })

        try:
            from pywebpush import webpush, WebPushException
        except ImportError:
            return {"sent": 0, "attempted": 0, "failed": 0, "error": "pywebpush is not installed"}

        sent = 0
        failures: list[dict[str, Any]] = []
        for row in subscriptions:
            subscription = {
                "endpoint": row["endpoint"],
                "keys": {"p256dh": row["p256dh"], "auth": row["auth"]},
            }
            try:
                await asyncio.to_thread(
                    webpush,
                    subscription_info=subscription,
                    data=payload,
                    vapid_private_key=private_key,
                    vapid_claims={"sub": os.getenv("VAPID_SUBJECT", "mailto:admin@localhost")},
                    ttl=60 * 60,
                )
                sent += 1
            except WebPushException as exc:
                status = getattr(exc.response, "status_code", None)
                if status in (404, 410):
                    await self.unsubscribe(row["endpoint"])
                failures.append({"endpoint": row["endpoint"][:80], "status": status, "error": str(exc)[:500]})
            except Exception as exc:
                failures.append({"endpoint": row["endpoint"][:80], "status": None, "error": str(exc)[:500]})

        return {"sent": sent, "attempted": len(subscriptions), "failed": len(failures), "failures": failures}

    def schedule(self, title: str, body: str, run_at: datetime, url: str = "/", tag: str | None = None) -> str:
        job_id = tag or f"push-{datetime.utcnow().timestamp()}"
        self.cancel(job_id)

        self.scheduler.scheduler.add_job(
            self._send_job,
            trigger="date",
            next_run_time=run_at,
            id=job_id,
            name=f"notification:{job_id}",
            replace_existing=True,
            args=[title, body, url, tag],
        )
        self._jobs[job_id] = job_id
        return job_id

    async def _send_job(self, title: str, body: str, url: str, tag: str | None) -> None:
        await self.send(title, body, url, tag)

    def cancel(self, job_id: str) -> bool:
        try:
            self.scheduler.scheduler.remove_job(job_id)
        except Exception:
            pass
        self._jobs.pop(job_id, None)
        return True
