"""选品相关 API。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import AsyncSessionLocal
from ..sourcing import service as sourcing_service

router = APIRouter(prefix="/api/sourcing", tags=["sourcing"])


async def get_db():
    async with AsyncSessionLocal() as db:
        yield db


class SearchReq(BaseModel):
    keyword: str = ""
    category_id: str = ""
    page: int = 1
    page_size: int = 20
    price_min: float | None = None
    price_max: float | None = None


class ImportReq(BaseModel):
    offer: str  # offerId 或 URL


class BatchImportReq(BaseModel):
    offers: list[str]


@router.post("/search")
async def search(req: SearchReq):
    return await sourcing_service.search(
        keyword=req.keyword, category_id=req.category_id, page=req.page,
        page_size=req.page_size, price_min=req.price_min, price_max=req.price_max,
    )


@router.post("/import")
async def import_offer(req: ImportReq, db: AsyncSession = Depends(get_db)):
    product = await sourcing_service.import_offer(db, req.offer)
    return _serialize_product(product)


@router.post("/import/batch")
async def batch_import(req: BatchImportReq, db: AsyncSession = Depends(get_db)):
    return await sourcing_service.batch_import(db, req.offers)


@router.post("/refresh/{product_id}")
async def refresh(product_id: int, db: AsyncSession = Depends(get_db)):
    product = await sourcing_service.refresh_product(db, product_id)
    return _serialize_product(product)


def _serialize_product(p) -> dict:
    import json
    return {
        "id": p.id, "source_offer_id": p.source_offer_id, "source_url": p.source_url,
        "title": p.title, "status": p.status, "price": p.price, "stock": p.stock,
        "image_urls": json.loads(p.image_urls) if p.image_urls else [],
        "category_source": p.category_source, "category_target": p.category_target,
        "source_seller": p.source_seller, "tags": p.tags, "error": p.error,
        "markup_ratio": p.markup_ratio, "mapped_data": p.mapped_data,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }
