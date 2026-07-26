"""设置 API：读写平台凭证与全局参数。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import AsyncSessionLocal, SettingsService

router = APIRouter(prefix="/api/settings", tags=["settings"])


async def get_db():
    async with AsyncSessionLocal() as db:
        yield db


class SetSettingsReq(BaseModel):
    items: dict[str, str]
    category: str = "general"


@router.get("")
async def get_settings():
    all_items = await SettingsService.get_multi()
    grouped: dict[str, dict[str, str]] = {}
    # 需要类别信息，重新按类别查
    from sqlalchemy import select
    from .. import models
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(models.Setting))
        for r in result.scalars().all():
            grouped.setdefault(r.category, {})[r.key] = r.value
    return grouped


@router.put("")
async def set_settings(req: SetSettingsReq):
    await SettingsService.set_multi(req.items, req.category)
    return {"ok": True}


@router.get("/test/{platform}")
async def test_connection(platform: str):
    """测试平台连通性。"""
    if platform == "alibaba":
        from ..sourcing.alibaba import AlibabaClient
        client = AlibabaClient(
            await SettingsService.get("alibaba_app_key"),
            await SettingsService.get("alibaba_app_secret"),
            await SettingsService.get("alibaba_access_token"),
        )
        ok = client.configured
        await client.close()
        return {"platform": "alibaba", "configured": ok,
                "message": "凭证已配置" if ok else "未配置 App Key/Secret"}
    if platform == "shopify":
        shop = await SettingsService.get("shopify_shop_url")
        token = await SettingsService.get("shopify_access_token")
        return {"platform": "shopify", "configured": bool(shop and token),
                "message": "已配置" if shop and token else "未配置店铺地址或 Token"}
    if platform == "generic":
        url = await SettingsService.get("generic_api_url")
        return {"platform": "generic", "configured": bool(url),
                "message": "已配置" if url else "未配置 API URL"}
    return {"platform": platform, "configured": False, "message": "未知平台"}
