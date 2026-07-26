"""铺货任务管理 API。"""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..db import AsyncSessionLocal
from ..push import runner
from ..scheduler import schedule_task_now

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


async def get_db():
    async with AsyncSessionLocal() as db:
        yield db


class CreateTaskReq(BaseModel):
    name: str
    task_type: str = "once"          # once | scheduled
    target_type: str = "shopify"     # shopify | generic | csv
    target_config: dict = {}
    filter_category: str = ""
    filter_keyword: str = ""
    filter_tags: str = ""
    filter_status: str = "mapped"
    limit: int = 50
    markup_ratio: float = 1.3
    auto_map_category: bool = True
    cron_expr: str = ""


class UpdateTaskReq(BaseModel):
    name: str | None = None
    target_type: str | None = None
    target_config: dict | None = None
    filter_category: str | None = None
    filter_keyword: str | None = None
    filter_tags: str | None = None
    filter_status: str | None = None
    limit: int | None = None
    markup_ratio: float | None = None
    auto_map_category: bool | None = None
    cron_expr: str | None = None
    status: str | None = None


@router.get("")
async def list_tasks(db: AsyncSession = Depends(get_db)):
    stmt = select(models.PushTask).order_by(models.PushTask.id.desc())
    result = await db.execute(stmt)
    return [_serialize_task(t) for t in result.scalars().all()]


@router.get("/{task_id}")
async def get_task(task_id: int, db: AsyncSession = Depends(get_db)):
    t = await db.get(models.PushTask, task_id)
    if not t:
        raise HTTPException(404, "任务不存在")
    return _serialize_task(t, full=True)


@router.post("")
async def create_task(req: CreateTaskReq, db: AsyncSession = Depends(get_db)):
    t = models.PushTask(
        name=req.name, task_type=req.task_type, target_type=req.target_type,
        target_config=req.target_config, filter_category=req.filter_category,
        filter_keyword=req.filter_keyword, filter_tags=req.filter_tags,
        filter_status=req.filter_status, limit=req.limit,
        markup_ratio=req.markup_ratio, auto_map_category=req.auto_map_category,
        cron_expr=req.cron_expr,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    if req.cron_expr and req.task_type == "scheduled":
        await schedule_task_now(t.id, req.cron_expr)
        await db.refresh(t)
    return _serialize_task(t)


@router.patch("/{task_id}")
async def update_task(task_id: int, req: UpdateTaskReq, db: AsyncSession = Depends(get_db)):
    t = await db.get(models.PushTask, task_id)
    if not t:
        raise HTTPException(404, "任务不存在")
    data = req.model_dump(exclude_none=True)
    for k, v in data.items():
        setattr(t, k, v)
    if "cron_expr" in data:
        await schedule_task_now(t.id, t.cron_expr)
        await db.refresh(t)
    await db.commit()
    await db.refresh(t)
    return _serialize_task(t)


@router.delete("/{task_id}")
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    t = await db.get(models.PushTask, task_id)
    if not t:
        raise HTTPException(404, "任务不存在")
    await db.delete(t)
    await db.commit()
    return {"ok": True}


@router.post("/{task_id}/run")
async def run_task(task_id: int, background: BackgroundTasks):
    """立即执行任务（后台异步）。"""
    background.add_task(_safe_run, task_id)
    return {"ok": True, "message": "任务已加入后台执行"}


async def _safe_run(task_id: int):
    try:
        await runner.run_task(task_id)
    except Exception as e:  # noqa: BLE001
        async with AsyncSessionLocal() as db:
            db.add(models.TaskLog(task_id=task_id, level="ERROR", message=f"手动执行失败: {e}"))
            await db.commit()


@router.get("/{task_id}/records")
async def task_records(
    task_id: int,
    status: str | None = None,
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models.PushRecord).where(models.PushRecord.task_id == task_id)
    if status:
        stmt = stmt.where(models.PushRecord.status == status)
    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = (await db.execute(count_stmt)).scalar() or 0
    stmt = stmt.order_by(models.PushRecord.id.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    return {
        "items": [_serialize_record(r) for r in result.scalars().all()],
        "total": total, "page": page, "page_size": page_size,
    }


@router.get("/{task_id}/logs")
async def task_logs(task_id: int, limit: int = 100, db: AsyncSession = Depends(get_db)):
    stmt = (select(models.TaskLog).where(models.TaskLog.task_id == task_id)
            .order_by(models.TaskLog.id.desc()).limit(limit))
    result = await db.execute(stmt)
    return [{"id": l.id, "level": l.level, "message": l.message,
             "created_at": l.created_at.isoformat() if l.created_at else None}
            for l in result.scalars().all()]


def _serialize_task(t: models.PushTask, full: bool = False) -> dict:
    d: dict[str, Any] = {
        "id": t.id, "name": t.name, "task_type": t.task_type, "status": t.status,
        "target_type": t.target_type, "target_config": t.target_config,
        "filter_category": t.filter_category, "filter_keyword": t.filter_keyword,
        "filter_tags": t.filter_tags, "filter_status": t.filter_status, "limit": t.limit,
        "markup_ratio": t.markup_ratio, "auto_map_category": t.auto_map_category,
        "cron_expr": t.cron_expr,
        "last_run_at": t.last_run_at.isoformat() if t.last_run_at else None,
        "next_run_at": t.next_run_at.isoformat() if t.next_run_at else None,
        "total": t.total, "success": t.success, "failed": t.failed,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }
    return d


def _serialize_record(r: models.PushRecord) -> dict:
    return {
        "id": r.id, "task_id": r.task_id, "product_id": r.product_id, "status": r.status,
        "target_item_id": r.target_item_id, "target_item_url": r.target_item_url,
        "message": r.message, "created_at": r.created_at.isoformat() if r.created_at else None,
    }
