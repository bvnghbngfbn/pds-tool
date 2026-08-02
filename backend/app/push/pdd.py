"""拼多多自动铺货 API 目标。"""
from __future__ import annotations

from typing import Any

from .base import register_target
from .base import PushResult
from .marketplace import (
    MarketplaceApiTarget,
    first_image,
    now_seconds,
    plain_text,
    price_yuan_to_fen,
    sign_sorted_params,
)

PDD_GATEWAY = "https://gw-api.pinduoduo.com/api/router"


@register_target("pdd")
class PddTarget(MarketplaceApiTarget):
    """拼多多铺货目标。config: client_id, client_secret, access_token, mall_id, api_url"""

    platform_name = "拼多多"
    id_field = "client_id"
    secret_field = "client_secret"

    def __init__(self, config: dict[str, Any]) -> None:
        super().__init__({**config, "api_url": config.get("api_url") or PDD_GATEWAY})
        self.category_id = config.get("category_id") or config.get("cat_id") or ""
        self.logistics_template_id = config.get("logistics_template_id") or ""
        self.shipment_limit_second = int(config.get("shipment_limit_second") or 172800)

    def _missing_message(self) -> str:
        missing = []
        if not self.app_id:
            missing.append("Client ID")
        if not self.app_secret:
            missing.append("Client Secret")
        if not self.access_token:
            missing.append("Access Token")
        if not self.category_id:
            missing.append("叶子类目 ID")
        if not self.logistics_template_id:
            missing.append("运费模板 ID")
        return f"拼多多未配置：{', '.join(missing)}"

    def _goods_payload(self, mapped_data: dict) -> dict[str, Any]:
        images = [u for u in mapped_data.get("images", []) if u]
        main_image = first_image(images)
        price_fen = price_yuan_to_fen(mapped_data.get("price"))
        stock = int(mapped_data.get("inventory", 0) or 0)
        offer_id = mapped_data.get("offer_id") or str(now_seconds())
        return {
            "type": "pdd.goods.add",
            "client_id": self.app_id,
            "access_token": self.access_token,
            "timestamp": now_seconds(),
            "data_type": "JSON",
            "goods_name": mapped_data.get("title", "")[:60],
            "cat_id": int(self.category_id),
            "goods_desc": plain_text(mapped_data.get("body_html", ""), 2000),
            "image_url": main_image,
            "carousel_gallery": images[:10],
            "detail_gallery": images[:20] or images[:10],
            "logistics_template_id": int(self.logistics_template_id),
            "shipment_limit_second": self.shipment_limit_second,
            "sku_list": [{
                "out_sku_sn": f"SRC-{offer_id}"[:100],
                "thumb_url": main_image,
                "quantity": stock,
                "normal_price": price_fen + 100,
                "group_price": price_fen,
                "spec": [],
            }],
            "outer_goods_id": str(offer_id),
        }

    async def push(self, mapped_data: dict) -> PushResult:
        if not (self.api_url and self.app_id and self.app_secret and self.access_token
                and self.category_id and self.logistics_template_id):
            return PushResult(False, message=self._missing_message())
        payload = self._goods_payload(mapped_data)
        payload["sign"] = sign_sorted_params(payload, self.app_secret)
        try:
            resp = await self._http.post(
                self.api_url,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            try:
                data = resp.json()
            except Exception:
                data = {"raw": resp.text[:500]}
            if resp.status_code == 200 and not data.get("error_response"):
                result = data.get("goods_add_response") or data.get("response") or data
                goods_id = str(result.get("goods_id") or result.get("goods_commit_id") or "")
                return PushResult(True, target_item_id=goods_id,
                                  target_item_url=f"https://mobile.yangkeduo.com/goods.html?goods_id={goods_id}" if goods_id else "",
                                  message="已提交到拼多多商品新增接口", payload={"request": payload, "response": data})
            err = data.get("error_response") or data
            return PushResult(False, message=f"拼多多返回错误: {err}", payload={"request": payload, "response": data})
        except Exception as e:
            return PushResult(False, message=f"拼多多网络错误: {e}", payload=payload)
