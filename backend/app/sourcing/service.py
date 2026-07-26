"""选品服务：编排 1688 API 客户端与页面解析，结果入库。"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..db import SettingsService
from .alibaba import AlibabaClient, AlibabaClientError
from .parser import parse_offer, extract_offer_id, ParseError


async def _build_client() -> AlibabaClient:
    app_key = await SettingsService.get("alibaba_app_key")
    app_secret = await SettingsService.get("alibaba_app_secret")
    token = await SettingsService.get("alibaba_access_token")
    return AlibabaClient(app_key, app_secret, token)


async def _parse_fallback_enabled() -> bool:
    return (await SettingsService.get("alibaba_allow_parse_fallback", "true")).lower() == "true"


async def search(keyword: str, category_id: str = "", page: int = 1, page_size: int = 20,
                 price_min: float | None = None, price_max: float | None = None) -> dict:
    """搜索 1688 商品。优先 API，失败则返回空结果（搜索无页面兜底）。"""
    client = await _build_client()
    try:
        if not client.configured:
            return {"items": [], "total": 0, "page": page, "warning": "未配置1688开放平台凭证，无法搜索。请在设置页填写 App Key/Secret。"}
        return await client.search_products(
            keyword=keyword, category_id=category_id, page=page, page_size=page_size,
            price_min=price_min, price_max=price_max,
        )
    finally:
        await client.close()


async def import_offer(db: AsyncSession, offer_text: str) -> models.Product:
    """通过 offerId 或 URL 导入单个商品到商品库。"""
    offer_id = extract_offer_id(offer_text)
    detail: dict[str, Any] | None = None

    client = await _build_client()
    try:
        if client.configured:
            try:
                detail = await client.get_product_detail(offer_id)
            except AlibabaClientError:
                detail = None
    finally:
        await client.close()

    if detail is None and await _parse_fallback_enabled():
        try:
            detail = await parse_offer(offer_id)
        except ParseError:
            detail = None

    if detail is None:
        # 无任何数据源可用，存一条占位记录
        product = models.Product(
            source_offer_id=offer_id,
            source_url=f"https://detail.1688.com/offer/{offer_id}.html",
            title=f"(待解析) offer {offer_id}",
            status=models.ProductStatus.FAILED.value,
            error="无可用数据源：未配置1688 API且页面解析失败",
            raw_data={}, mapped_data={},
        )
    else:
        image_urls = detail.get("image_urls", [])
        product = models.Product(
            source_offer_id=detail.get("offer_id", offer_id),
            source_url=detail.get("url", ""),
            title=detail.get("title", ""),
            status=models.ProductStatus.SOURCED.value,
            price=float(detail.get("price", 0) or 0),
            stock=int(detail.get("stock", 0) or 0),
            image_urls=json.dumps(image_urls, ensure_ascii=False),
            category_source=detail.get("category", ""),
            source_seller=detail.get("seller", ""),
            raw_data=detail,
            mapped_data={},
        )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


async def batch_import(db: AsyncSession, offer_texts: list[str]) -> list[dict]:
    """批量导入。返回每条结果。"""
    results = []
    for text in offer_texts:
        try:
            p = await import_offer(db, text)
            results.append({"offer_id": p.source_offer_id, "id": p.id, "status": p.status,
                            "title": p.title, "ok": p.status != models.ProductStatus.FAILED.value})
        except Exception as e:  # noqa: BLE001
            results.append({"offer_id": text, "ok": False, "error": str(e)})
    return results


async def refresh_product(db: AsyncSession, product_id: int) -> models.Product:
    """重新拉取商品数据。"""
    product = await db.get(models.Product, product_id)
    if not product:
        raise ValueError("商品不存在")
    offer_id = product.source_offer_id
    detail = None
    client = await _build_client()
    try:
        if client.configured:
            try:
                detail = await client.get_product_detail(offer_id)
            except AlibabaClientError:
                detail = None
    finally:
        await client.close()
    if detail is None and await _parse_fallback_enabled():
        detail = await parse_offer(offer_id)
    if detail:
        product.title = detail.get("title", product.title)
        product.price = float(detail.get("price", 0) or 0)
        product.stock = int(detail.get("stock", 0) or 0)
        product.image_urls = json.dumps(detail.get("image_urls", []), ensure_ascii=False)
        product.category_source = detail.get("category", "")
        product.source_seller = detail.get("seller", "")
        product.raw_data = detail
        product.status = models.ProductStatus.SOURCED.value
        product.error = ""
        product.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(product)
    return product
