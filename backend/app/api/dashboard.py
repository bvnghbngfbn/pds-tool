"""仪表盘统计 API。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..auth import get_current_user
from ..db import AsyncSessionLocal

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


async def get_db():
    async with AsyncSessionLocal() as db:
        yield db


@router.get("/stats")
async def stats(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p_rows = (await db.execute(
        select(models.Product.status, func.count(models.Product.id)).group_by(models.Product.status)
    )).all()
    products_by_status = {r[0]: r[1] for r in p_rows}
    product_total = sum(products_by_status.values())

    t_rows = (await db.execute(
        select(models.PushTask.status, func.count(models.PushTask.id)).group_by(models.PushTask.status)
    )).all()
    tasks_by_status = {r[0]: r[1] for r in t_rows}

    r_rows = (await db.execute(
        select(models.PushRecord.status, func.count(models.PushRecord.id)).group_by(models.PushRecord.status)
    )).all()
    records_by_status = {r[0]: r[1] for r in r_rows}
    push_total = sum(records_by_status.values())
    push_success = records_by_status.get("success", 0)

    success_rate = round(push_success / push_total * 100, 1) if push_total else 0.0

    from datetime import datetime, timedelta
    trend = []
    for i in range(6, -1, -1):
        day = datetime.utcnow().date() - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day + timedelta(days=1), datetime.min.time())
        cnt = (await db.execute(
            select(func.count(models.PushRecord.id)).where(
                models.PushRecord.status == "success",
                models.PushRecord.created_at >= day_start,
                models.PushRecord.created_at < day_end,
            )
        )).scalar() or 0
        trend.append({"date": day.isoformat(), "count": cnt})

    return {
        "product_total": product_total,
        "products_by_status": products_by_status,
        "tasks_by_status": tasks_by_status,
        "push_total": push_total,
        "push_success": push_success,
        "push_failed": records_by_status.get("failed", 0),
        "success_rate": success_rate,
        "trend": trend,
    }