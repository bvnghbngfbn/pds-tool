"""快手小店自动铺货 API 目标。"""
from __future__ import annotations

from typing import Any

from .base import register_target
from .base import PushResult
from .marketplace import (
    MarketplaceApiTarget,
    compact_json,
    hmac_sha256_hex,
    md5_upper,
    now_millis,
    plain_text,
    price_yuan_to_fen,
    sign_sorted_params,
)

KUAISHOU_GATEWAY = "https://openapi.kwaixiaodian.com"


@register_target("kuaishou")
class KuaishouTarget(MarketplaceApiTarget):
    """快手小店铺货目标。config: app_id, app_secret, access_token, shop_id, api_url"""

    platform_name = "快手小店"
    id_field = "app_id"
    secret_field = "app_secret"

    def __init__(self, config: dict[str, Any]) -> None:
        super().__init__({**config, "api_url": config.get("api_url") or KUAISHOU_GATEWAY})
        self.sign_secret = config.get("sign_secret") or self.app_secret
        self.category_id = config.get("category_id") or ""
        self.express_template_id = config.get("express_template_id") or ""
        self.method = config.get("method") or "open.item.new"
        self.sign_method = (config.get("sign_method") or "HMAC_SHA256").upper()

    def _missing_message(self) -> str:
        missing = []
        if not self.app_id:
            missing.append("App ID")
        if not self.sign_secret:
            missing.append("Sign Secret")
        if not self.access_token:
            missing.append("Access Token")
        if not self.category_id:
            missing.append("类目 ID")
        if not self.express_template_id:
            missing.append("运费模板 ID")
        return f"快手小店未配置：{', '.join(missing)}"

    def _param(self, mapped_data: dict) -> dict[str, Any]:
        images = [u for u in mapped_data.get("images", []) if u]
        price_fen = price_yuan_to_fen(mapped_data.get("price"))
        stock = int(mapped_data.get("inventory", 0) or 0)
        offer_id = int(str(mapped_data.get("offer_id") or now_millis())[:18])
        title = mapped_data.get("title", "")[:60]
        return {
            "title": title,
            "relItemId": offer_id,
            "categoryId": int(self.category_id),
            "imageUrls": images[:9],
            "skuList": [{
                "relSkuId": offer_id,
                "skuStock": stock,
                "skuSalePrice": price_fen,
                "skuNick": f"SRC-{offer_id}",
            }],
            "details": plain_text(mapped_data.get("body_html", ""), 1000) or title,
            "detailImageUrls": images[:50],
            "serviceRule": {
                "deliveryMethod": "logistics",
                "deliveryTimeMode": "spot",
            },
            "expressTemplateId": int(self.express_template_id),
            "payWay": 2,
            "multipleStock": False,
        }

    def _sign(self, params: dict[str, Any]) -> str:
        if self.sign_method == "MD5":
            return sign_sorted_params(params, self.sign_secret)
        raw = self.sign_secret + "".join(
            f"{k}{params[k]}" for k in sorted(params) if k != "sign"
        ) + self.sign_secret
        return hmac_sha256_hex(raw, self.sign_secret)

    async def push(self, mapped_data: dict) -> PushResult:
        if not (self.api_url and self.app_id and self.sign_secret and self.access_token
                and self.category_id and self.express_template_id):
            return PushResult(False, message=self._missing_message())
        param = self._param(mapped_data)
        system_params = {
            "appkey": self.app_id,
            "timestamp": now_millis(),
            "access_token": self.access_token,
            "version": 1,
            "param": compact_json(param),
            "method": self.method,
            "signMethod": self.sign_method,
        }
        system_params["sign"] = self._sign(system_params)
        try:
            resp = await self._http.post(
                self.api_url.rstrip("/"),
                json=system_params,
                headers={"Content-Type": "application/json"},
            )
            try:
                data = resp.json()
            except Exception:
                data = {"raw": resp.text[:500]}
            result_ok = str(data.get("result", data.get("code", ""))) in ("1", "0", "10000")
            if resp.status_code == 200 and result_ok:
                result = data.get("data") or {}
                item_id = str(result.get("kwaiItemId") or result.get("itemId") or "")
                return PushResult(True, target_item_id=item_id, target_item_url="",
                                  message="已提交到快手小店新增商品接口",
                                  payload={"request": system_params, "response": data})
            return PushResult(False, message=f"快手小店返回错误: {data}",
                              payload={"request": system_params, "response": data})
        except Exception as e:
            return PushResult(False, message=f"快手小店网络错误: {e}", payload={"request": system_params})
