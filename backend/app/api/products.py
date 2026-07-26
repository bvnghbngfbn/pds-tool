"""商品库管理 API。"""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..db import AsyncSessionLocal
from ..transform import mapper as transform_mapper

router = APIRouter(prefix="/api/products", tags=["products"])


async def get_db():
    async with AsyncSessionLocal() as db:
        yield db


class MapReq(BaseModel):
    markup_ratio: float = 1.3
    auto_map: bool = True
    target_category: str = ""


class MapBatchReq(BaseModel):
    product_ids: list[int]
    markup_ratio: float = 1.3
    auto_map: bool = True


class UpdateProductReq(BaseModel):
    title: str | None = None
    tags: str | None = None
    markup_ratio: float | None = None
    category_target: str | None = None
    status: str | None = None


@router.get("")
async def list_products(
    status: str | None = None,
    keyword: str | None = None,
    category: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models.Product)
    if status:
        stmt = stmt.where(models.Product.status == status)
    if keyword:
        stmt = stmt.where(models.Product.title.like(f"%{keyword}%"))
    if category:
        stmt = stmt.where(
            models.Product.category_source.contains(category)
            | models.Product.category_target.contains(category)
        )
    # 总数
    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = (await db.execute(count_stmt)).scalar() or 0
    stmt = stmt.order_by(models.Product.id.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    items = [_serialize(p) for p in result.scalars().all()]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{product_id}")
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(models.Product, product_id)
    if not p:
        raise HTTPException(404, "商品不存在")
    return _serialize(p, full=True)


@router.patch("/{product_id}")
async def update_product(product_id: int, req: UpdateProductReq, db: AsyncSession = Depends(get_db)):
    p = await db.get(models.Product, product_id)
    if not p:
        raise HTTPException(404, "商品不存在")
    data = req.model_dump(exclude_none=True)
    for k, v in data.items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return _serialize(p)


@router.delete("/{product_id}")
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(models.Product, product_id)
    if not p:
        raise HTTPException(404, "商品不存在")
    await db.delete(p)
    await db.commit()
    return {"ok": True}


@router.post("/{product_id}/map")
async def map_product(product_id: int, req: MapReq, db: AsyncSession = Depends(get_db)):
    p = await transform_mapper.map_product(db, product_id, req.markup_ratio, req.auto_map, req.target_category)
    return _serialize(p, full=True)


@router.post("/map/batch")
async def map_batch(req: MapBatchReq, db: AsyncSession = Depends(get_db)):
    count = await transform_mapper.map_batch(db, req.product_ids, req.markup_ratio, req.auto_map)
    return {"mapped": count, "total": len(req.product_ids)}


@router.get("/stats/summary")
async def stats_summary(db: AsyncSession = Depends(get_db)):
    """商品库状态分布。"""
    stmt = select(models.Product.status, func.count(models.Product.id)).group_by(models.Product.status)
    rows = (await db.execute(stmt)).all()
    by_status = {r[0]: r[1] for r in rows}
    total = sum(by_status.values())
    return {"total": total, "by_status": by_status}


def _serialize(p: models.Product, full: bool = False) -> dict:
    d: dict[str, Any] = {
        "id": p.id, "source_offer_id": p.source_offer_id, "source_url": p.source_url,
        "title": p.title, "status": p.status, "price": p.price, "stock": p.stock,
        "image_urls": json.loads(p.image_urls) if p.image_urls else [],
        "category_source": p.category_source, "category_target": p.category_target,
        "source_seller": p.source_seller, "tags": p.tags, "error": p.error,
        "markup_ratio": p.markup_ratio,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }
    if full:
        d["raw_data"] = p.raw_data
        d["mapped_data"] = p.mapped_data
    return d
