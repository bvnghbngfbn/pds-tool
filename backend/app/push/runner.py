"""铺货执行器：编排商品筛选 → 转换 → 推送 → 记录。"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..db import SettingsService
from ..security import sanitize_sql_like
from ..transform import mapper as transform_mapper
from .base import get_target, PushResult
from . import shopify  # noqa: F401
from . import generic  # noqa: F401
from . import csv_export  # noqa: F401
from . import pdd  # noqa: F401
from . import douyin  # noqa: F401
from . import kuaishou  # noqa: F401


async def _select_products(db: AsyncSession, task: models.PushTask) -> list[models.Product]:
    """按任务筛选条件选出待铺货商品。"""
    stmt = select(models.Product)
    if task.filter_status:
        stmt = stmt.where(models.Product.status == task.filter_status)
    else:
        stmt = stmt.where(models.Product.status.in_(
            [models.ProductStatus.MAPPED.value, models.ProductStatus.PENDING.value,
             models.ProductStatus.SOURCED.value]
        ))
    if task.filter_category:
        safe_cat = sanitize_sql_like(task.filter_category)
        stmt = stmt.where(
            (models.Product.category_source.contains(safe_cat, escape="\\"))
            | (models.Product.category_target.contains(safe_cat, escape="\\"))
        )
    if task.filter_keyword:
        safe_kw = sanitize_sql_like(task.filter_keyword)
        kw = f"%{safe_kw}%"
        stmt = stmt.where(
            models.Product.title.like(kw, escape="\\") | models.Product.tags.like(kw, escape="\\")
        )
    if task.filter_tags:
        for t in task.filter_tags.split(","):
            t = t.strip()
            if t:
                safe_t = sanitize_sql_like(t)
                stmt = stmt.where(models.Product.tags.like(f"%{safe_t}%", escape="\\"))
    stmt = stmt.limit(task.limit if task.limit > 0 else 50)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def _build_target_config(target_type: str) -> dict[str, Any]:
    """从 settings 读取目标平台配置。"""
    if target_type == models.PushTargetType.SHOPIFY.value:
        return {
            "shop_url": await SettingsService.get("shopify_shop_url"),
            "access_token": await SettingsService.get("shopify_access_token"),
            "location_id": await SettingsService.get("shopify_location_id"),
        }
    if target_type == models.PushTargetType.PDD.value:
        return {
            "client_id": await SettingsService.get("pdd_client_id"),
            "client_secret": await SettingsService.get("pdd_client_secret"),
            "access_token": await SettingsService.get("pdd_access_token"),
            "mall_id": await SettingsService.get("pdd_mall_id"),
            "api_url": await SettingsService.get("pdd_api_url"),
        }
    if target_type == models.PushTargetType.DOUYIN.value:
        return {
            "app_key": await SettingsService.get("douyin_app_key"),
            "app_secret": await SettingsService.get("douyin_app_secret"),
            "access_token": await SettingsService.get("douyin_access_token"),
            "shop_id": await SettingsService.get("douyin_shop_id"),
            "api_url": await SettingsService.get("douyin_api_url"),
        }
    if target_type == models.PushTargetType.KUAISHOU.value:
        return {
            "app_id": await SettingsService.get("kuaishou_app_id"),
            "app_secret": await SettingsService.get("kuaishou_app_secret"),
            "access_token": await SettingsService.get("kuaishou_access_token"),
            "shop_id": await SettingsService.get("kuaishou_shop_id"),
            "api_url": await SettingsService.get("kuaishou_api_url"),
        }
    if target_type == models.PushTargetType.GENERIC.value:
        return {
            "api_url": await SettingsService.get("generic_api_url"),
            "api_key": await SettingsService.get("generic_api_key"),
        }
    if target_type == models.PushTargetType.CSV.value:
        return {"export_dir": await SettingsService.get("csv_export_dir")}
    return {}


async def run_task(task_id: int) -> dict:
    """执行一次铺货任务。返回统计。"""
    from ..db import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        task = await db.get(models.PushTask, task_id)
        if not task:
            raise ValueError("任务不存在")
        task.status = models.PushTaskStatus.RUNNING.value
        task.last_run_at = datetime.utcnow()
        task.total = task.success = task.failed = 0
        await db.commit()
        await _log(db, task_id, "INFO", f"开始执行铺货任务: {task.name}")

        products = await _select_products(db, task)
        await _log(db, task_id, "INFO", f"筛选到 {len(products)} 个商品")
        task.total = len(products)

        target_cfg = await _build_target_config(task.target_type)
        target_cfg.update(task.target_config or {})
        target = get_target(task.target_type, target_cfg)

        try:
            for product in products:
                if not product.mapped_data:
                    mapped = transform_mapper.transform(
                        product.raw_data or {},
                        markup_ratio=task.markup_ratio,
                        auto_map=task.auto_map_category,
                    )
                    product.mapped_data = mapped
                    product.markup_ratio = task.markup_ratio
                    product.category_target = mapped.get("category", "")
                    if product.status == models.ProductStatus.SOURCED.value:
                        product.status = models.ProductStatus.MAPPED.value

                mapped_data = dict(product.mapped_data)
                result: PushResult = await target.push(mapped_data)

                record = models.PushRecord(
                    task_id=task.id,
                    product_id=product.id,
                    status=models.PushRecordStatus.SUCCESS.value if result.success
                    else models.PushRecordStatus.FAILED.value,
                    target_item_id=result.target_item_id,
                    target_item_url=result.target_item_url,
                    message=result.message,
                    payload={"mapped": mapped_data, "response": result.payload},
                )
                db.add(record)
                if result.success:
                    task.success += 1
                    product.status = models.ProductStatus.PUSHED.value
                else:
                    task.failed += 1
                    product.status = models.ProductStatus.FAILED.value
                    product.error = result.message
                await db.commit()
        finally:
            await target.close()

        task.status = models.PushTaskStatus.DONE.value if task.failed == 0 else (
            models.PushTaskStatus.ERROR.value if task.success == 0 else models.PushTaskStatus.DONE.value
        )
        await _log(db, task_id, "INFO",
                   f"任务完成: 总{task.total} 成功{task.success} 失败{task.failed}")
        await db.commit()
        return {"total": task.total, "success": task.success, "failed": task.failed,
                "status": task.status}


async def _log(db: AsyncSession, task_id: int | None, level: str, message: str) -> None:
    db.add(models.TaskLog(task_id=task_id, level=level, message=message))
    await db.commit()
