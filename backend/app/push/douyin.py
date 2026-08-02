"""抖音商店自动铺货 API 目标。"""
from __future__ import annotations

from typing import Any
from urllib.parse import urlencode

from .base import register_target
from .base import PushResult
from .marketplace import (
    MarketplaceApiTarget,
    compact_json,
    first_image,
    hmac_sha256_hex,
    now_seconds,
    plain_text,
    price_yuan_to_fen,
)

DOUYIN_GATEWAY = "https://openapi-fxg.jinritemai.com"


@register_target("douyin")
class DouyinTarget(MarketplaceApiTarget):
    """抖音商店铺货目标。config: app_key, app_secret, access_token, shop_id, api_url"""

    platform_name = "抖音商店"
    id_field = "app_key"
    secret_field = "app_secret"

    def __init__(self, config: dict[str, Any]) -> None:
        super().__init__({**config, "api_url": config.get("api_url") or DOUYIN_GATEWAY})
        self.category_id = config.get("category_id") or ""
        self.freight_id = config.get("freight_id") or ""
        self.method = config.get("method") or "product.addV2"

    def _missing_message(self) -> str:
        missing = []
        if not self.app_id:
            missing.append("App Key")
        if not self.app_secret:
            missing.append("App Secret")
        if not self.access_token:
            missing.append("Access Token")
        if not self.category_id:
            missing.append("类目 ID")
        if not self.freight_id:
            missing.append("运费模板 ID")
        return f"抖音商店未配置：{', '.join(missing)}"

    def _param_json(self, mapped_data: dict) -> str:
        images = [u for u in mapped_data.get("images", []) if u]
        price_fen = price_yuan_to_fen(mapped_data.get("price"))
        stock = int(mapped_data.get("inventory", 0) or 0)
        offer_id = str(mapped_data.get("offer_id") or now_seconds())
        body = {
            "name": mapped_data.get("title", "")[:60],
            "out_product_id": offer_id,
            "category_leaf_id": int(self.category_id),
            "pic": images[:5],
            "description": mapped_data.get("body_html", "")[:50000],
            "freight_id": int(self.freight_id),
            "reduce_type": 1,
            "spec_prices": [{
                "out_sku_id": f"SRC-{offer_id}"[:255],
                "price": price_fen,
                "stock_num": stock,
                "sku_type": 0,
            }],
            "spec_prices_v2": [{
                "out_sku_id": f"SRC-{offer_id}"[:255],
                "price": price_fen,
                "stock_num_map": {"0": stock},
                "sku_type": 0,
            }],
            "mobile": "",
            "product_format_new": {},
            "delivery_delay_day": 2,
            "pay_type": 0,
            "recommend_remark": plain_text(mapped_data.get("body_html", ""), 200),
            "img": first_image(images),
        }
        return compact_json(body)

    def _sign(self, method: str, param_json: str, timestamp: str, version: str = "2") -> str:
        pattern = (
            f"app_key{self.app_id}"
            f"method{method}"
            f"param_json{param_json}"
            f"timestamp{timestamp}"
            f"v{version}"
        )
        return hmac_sha256_hex(f"{self.app_secret}{pattern}{self.app_secret}", self.app_secret)

    async def push(self, mapped_data: dict) -> PushResult:
        if not (self.api_url and self.app_id and self.app_secret and self.access_token
                and self.category_id and self.freight_id):
            return PushResult(False, message=self._missing_message())
        method = self.method
        path = "/" + method.replace(".", "/")
        param_json = self._param_json(mapped_data)
        timestamp = str(now_seconds())
        version = "2"
        query = {
            "method": method,
            "app_key": self.app_id,
            "access_token": self.access_token,
            "timestamp": timestamp,
            "v": version,
            "sign_method": "hmac-sha256",
            "sign": self._sign(method, param_json, timestamp, version),
        }
        url = f"{self.api_url.rstrip('/')}{path}?{urlencode(query)}"
        try:
            resp = await self._http.post(url, content=param_json.encode("utf-8"),
                                         headers={"Content-Type": "application/json"})
            try:
                data = resp.json()
            except Exception:
                data = {"raw": resp.text[:500]}
            if resp.status_code == 200 and str(data.get("code", "0")) in ("0", "10000"):
                result = data.get("data") or data.get("result") or {}
                product_id = str(result.get("product_id") or result.get("product_id_str") or "")
                return PushResult(True, target_item_id=product_id, target_item_url="",
                                  message="已提交到抖音商店商品接口",
                                  payload={"param_json": param_json, "response": data})
            return PushResult(False, message=f"抖音商店返回错误: {data}",
                              payload={"param_json": param_json, "response": data})
        except Exception as e:
            return PushResult(False, message=f"抖音商店网络错误: {e}", payload={"param_json": param_json})
