"""任务调度器：扫描定时铺货任务并触发执行。

使用 APScheduler 后台调度，每 60s 扫描一次 due 的定时任务。
支持 cron 表达式（5 段：分 时 日 月 周）。
"""
from __future__ import annotations

import asyncio
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from . import models
from .config import settings as app_settings
from .db import AsyncSessionLocal
from .push.runner import run_task


_scheduler: AsyncIOScheduler | None = None
_scan_job = None


def _next_run(cron_expr: str, base: datetime | None = None) -> datetime | None:
    """根据 cron 表达式计算下次运行时间。"""
    try:
        trigger = CronTrigger.from_crontab(cron_expr)
        return trigger.get_next_fire_time(None, base or datetime.utcnow())
    except Exception:  # noqa: BLE001
        return None


async def _scan() -> None:
    """扫描 due 的定时任务并执行。"""
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        now = datetime.utcnow()
        stmt = select(models.PushTask).where(
            models.PushTask.cron_expr != "",
            models.PushTask.task_type == models.PushTaskType.SCHEDULED.value,
            models.PushTask.status != models.PushTaskStatus.RUNNING.value,
        )
        result = await db.execute(stmt)
        tasks = list(result.scalars().all())

    for task in tasks:
        async with AsyncSessionLocal() as db:
            t = await db.get(models.PushTask, task.id)
            if not t or t.status == models.PushTaskStatus.RUNNING.value:
                continue
            # 计算下次运行时间（若为空则初始化）
            if t.next_run_at is None:
                t.next_run_at = _next_run(t.cron_expr)
                await db.commit()
                continue
            if t.next_run_at > now:
                continue
            # due，触发执行（异步，不阻塞扫描）
            t.next_run_at = _next_run(t.cron_expr, now)
            await db.commit()
        # 在后台执行，避免一次扫描串行
        asyncio.create_task(_safe_run(task.id))


async def _safe_run(task_id: int) -> None:
    try:
        await run_task(task_id)
    except Exception as e:  # noqa: BLE001
        async with AsyncSessionLocal() as db:
            db.add(models.TaskLog(task_id=task_id, level="ERROR", message=f"调度执行失败: {e}"))
            await db.commit()


async def start_scheduler() -> None:
    global _scheduler, _scan_job
    if not app_settings.scheduler_enabled:
        return
    _scheduler = AsyncIOScheduler()
    interval = app_settings.scheduler_interval_seconds
    _scheduler.add_job(_scan, "interval", seconds=interval, id="pds_scan", max_instances=1)
    _scheduler.start()


async def stop_scheduler() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None


async def schedule_task_now(task_id: int, cron_expr: str) -> datetime | None:
    """设置/更新任务的下次运行时间。"""
    async with AsyncSessionLocal() as db:
        t = await db.get(models.PushTask, task_id)
        if not t:
            return None
        t.cron_expr = cron_expr
        t.next_run_at = _next_run(cron_expr) if cron_expr else None
        await db.commit()
        return t.next_run_at
