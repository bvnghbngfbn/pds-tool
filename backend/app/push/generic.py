"""通用 HTTP API 铺货目标。

适配自建店铺 / 第三方系统：POST 商品 JSON 到配置的 API URL，
以 Bearer / X-API-Key 鉴权。响应需包含 id/url 字段。
也可对接有赞、微店等支持开放 API 的平台（按其 schema 调整）。
"""
from __future__ import annotations

from typing import Any

import httpx

from .base import PushTarget, PushResult, register_target


@register_target("generic")
class GenericTarget(PushTarget):
    """通用 REST 目标。config: api_url, api_key, auth_header(默认 X-API-Key)"""

    def __init__(self, config: dict[str, Any]) -> None:
        super().__init__(config)
        self.api_url = (config.get("api_url") or "").strip()
        self.api_key = config.get("api_key") or ""
        self.auth_header = config.get("auth_header") or "X-API-Key"
        self._http = httpx.AsyncClient(timeout=30.0)

    async def push(self, mapped_data: dict) -> PushResult:
        if not self.api_url:
            return PushResult(False, message="通用 API URL 未配置")
        payload = {
            "title": mapped_data.get("title", ""),
            "description": mapped_data.get("body_html", ""),
            "price": mapped_data.get("price", "0"),
            "stock": int(mapped_data.get("inventory", 0) or 0),
            "images": mapped_data.get("images", []),
            "category": mapped_data.get("category", ""),
            "sku": f"1688-{mapped_data.get('offer_id', '')}",
            "source": "1688",
            "source_url": mapped_data.get("source_url", ""),
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers[self.auth_header] = self.api_key
        try:
            resp = await self._http.post(self.api_url, json=payload, headers=headers)
            if resp.status_code in (200, 201, 202):
                try:
                    data = resp.json()
                except Exception:  # noqa: BLE001
                    data = {"raw": resp.text[:500]}
                item_id = str(data.get("id") or data.get("product_id") or data.get("item_id") or "")
                item_url = data.get("url") or data.get("link") or ""
                return PushResult(True, target_item_id=item_id, target_item_url=item_url,
                                  message="已推送到通用 API", payload=payload)
            return PushResult(False, message=f"API 返回 {resp.status_code}: {resp.text[:300]}",
                              payload=payload)
        except httpx.HTTPError as e:
            return PushResult(False, message=f"网络错误: {e}", payload=payload)

    async def close(self) -> None:
        await self._http.aclose()
