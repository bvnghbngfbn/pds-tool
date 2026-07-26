"""Shopify 铺货目标。

使用 Shopify Admin REST API 创建商品。
认证：X-Shopify-Access-Token（在 Shopify Partner 后台创建自定义 App 获得）。
文档：https://shopify.dev/docs/api/admin-rest
"""
from __future__ import annotations

from typing import Any

import httpx

from .base import PushTarget, PushResult, register_target

API_VERSION = "2024-01"


@register_target("shopify")
class ShopifyTarget(PushTarget):
    """Shopify REST 目标。config: shop_url, access_token, location_id?"""

    def __init__(self, config: dict[str, Any]) -> None:
        super().__init__(config)
        self.shop = (config.get("shop_url") or "").strip().rstrip("/")
        self.token = config.get("access_token") or ""
        self.location_id = config.get("location_id") or ""
        if self.shop and not self.shop.startswith("http"):
            self.shop = f"https://{self.shop}"
        self._http = httpx.AsyncClient(timeout=30.0)

    def _base(self) -> str:
        return f"{self.shop}/admin/api/{API_VERSION}"

    async def push(self, mapped_data: dict) -> PushResult:
        if not self.shop or not self.token:
            return PushResult(False, message="Shopify 店铺地址或 Access Token 未配置")
        sku = f"1688-{mapped_data.get('offer_id', '')}"
        images = [{"src": u} for u in mapped_data.get("images", []) if u]
        payload: dict[str, Any] = {
            "product": {
                "title": mapped_data.get("title", "")[:255],
                "body_html": mapped_data.get("body_html", ""),
                "vendor": "1688",
                "product_type": mapped_data.get("category", ""),
                "status": "active",
                "variants": [{
                    "price": mapped_data.get("price", "0"),
                    "sku": sku,
                    "inventory_management": "shopify",
                    "inventory_quantity": int(mapped_data.get("inventory", 0) or 0),
                    "requires_shipping": True,
                }],
                "images": images,
                "tags": mapped_data.get("source_category", ""),
            }
        }
        try:
            resp = await self._http.post(
                f"{self._base()}/products.json",
                json=payload,
                headers={"X-Shopify-Access-Token": self.token, "Content-Type": "application/json"},
            )
            if resp.status_code in (200, 201):
                data = resp.json().get("product", {})
                gid = str(data.get("id", ""))
                # 设置库存（如指定 location）
                if self.location_id and gid:
                    try:
                        inv_id = (data.get("variants") or [{}])[0].get("inventory_item_id")
                        if inv_id:
                            await self._http.post(
                                f"{self._base()}/inventory_levels/set.json",
                                json={"location_id": self.location_id,
                                      "inventory_item_id": inv_id,
                                      "available": int(mapped_data.get("inventory", 0) or 0)},
                                headers={"X-Shopify-Access-Token": self.token},
                            )
                    except Exception:  # noqa: BLE001
                        pass
                url = f"{self.shop}/products/{gid}" if gid else ""
                return PushResult(True, target_item_id=gid, target_item_url=url,
                                  message="已上架到 Shopify", payload=payload)
            return PushResult(False, message=f"Shopify 返回 {resp.status_code}: {resp.text[:300]}",
                              payload=payload)
        except httpx.HTTPError as e:
            return PushResult(False, message=f"网络错误: {e}", payload=payload)

    async def close(self) -> None:
        await self._http.aclose()
