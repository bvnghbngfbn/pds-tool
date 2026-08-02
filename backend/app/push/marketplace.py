"""多平台电商 API 铺货目标基础工具。"""
from __future__ import annotations

import hashlib
import hmac
import json
import re
import time
from typing import Any

import httpx

from .base import PushTarget, PushResult
from ..security import validate_url


class MarketplaceApiTarget(PushTarget):
    """面向国内电商平台的基础 API 铺货目标。"""

    platform_name = "电商平台"
    id_field = "app_id"
    secret_field = "app_secret"

    def __init__(self, config: dict[str, Any]) -> None:
        super().__init__(config)
        self.api_url = (config.get("api_url") or "").strip()
        self.access_token = config.get("access_token") or ""
        self.shop_id = config.get("shop_id") or config.get("mall_id") or ""
        self.app_id = config.get(self.id_field) or config.get("app_id") or config.get("client_id") or ""
        self.app_secret = config.get(self.secret_field) or config.get("app_secret") or config.get("client_secret") or ""
        if self.api_url and not validate_url(self.api_url):
            self.api_url = ""
        self._http = httpx.AsyncClient(timeout=30.0)

    def _missing_message(self) -> str:
        missing = []
        if not self.api_url:
            missing.append("API 地址")
        if not self.access_token:
            missing.append("Access Token")
        if not self.shop_id:
            missing.append("店铺 ID")
        if not self.app_id:
            missing.append("App/Client ID")
        if not self.app_secret:
            missing.append("App/Client Secret")
        return f"{self.platform_name}未配置：{', '.join(missing)}"

    def _payload(self, mapped_data: dict) -> dict[str, Any]:
        return {
            "platform": self.type_name,
            "shop_id": self.shop_id,
            "credentials": {
                "app_id": self.app_id,
                "access_token": self.access_token,
            },
            "product": {
                "title": mapped_data.get("title", "")[:255],
                "description": mapped_data.get("body_html", ""),
                "price": mapped_data.get("price", "0"),
                "stock": int(mapped_data.get("inventory", 0) or 0),
                "images": mapped_data.get("images", []),
                "category": mapped_data.get("category", ""),
                "sku": f"SRC-{mapped_data.get('offer_id', '')}",
                "source_url": mapped_data.get("source_url", ""),
                "source_category": mapped_data.get("source_category", ""),
            },
        }

    async def push(self, mapped_data: dict) -> PushResult:
        if not (self.api_url and self.access_token and self.shop_id and self.app_id and self.app_secret):
            return PushResult(False, message=self._missing_message())
        payload = self._payload(mapped_data)
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.access_token}",
            "X-Platform": self.type_name,
        }
        try:
            resp = await self._http.post(self.api_url, json=payload, headers=headers)
            if resp.status_code in (200, 201, 202):
                try:
                    data = resp.json()
                except Exception:
                    data = {"raw": resp.text[:500]}
                item_id = str(data.get("id") or data.get("product_id") or data.get("item_id") or "")
                item_url = data.get("url") or data.get("link") or ""
                return PushResult(True, target_item_id=item_id, target_item_url=item_url,
                                  message=f"已推送到{self.platform_name}", payload=payload)
            return PushResult(False, message=f"{self.platform_name}返回 {resp.status_code}: {resp.text[:300]}",
                              payload=payload)
        except httpx.HTTPError as e:
            return PushResult(False, message=f"{self.platform_name}网络错误: {e}", payload=payload)

    async def close(self) -> None:
        await self._http.aclose()


def compact_json(data: Any) -> str:
    """稳定 JSON：用于签名和平台 param_json。"""
    return json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def md5_upper(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest().upper()


def hmac_sha256_hex(text: str, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), text.encode("utf-8"), hashlib.sha256).hexdigest()


def sign_sorted_params(params: dict[str, Any], secret: str, upper: bool = True) -> str:
    """按 key ASCII 升序拼接 key+value，首尾拼接 secret 后计算 MD5。"""
    raw = secret + "".join(f"{k}{params[k]}" for k in sorted(params) if k != "sign") + secret
    signed = hashlib.md5(raw.encode("utf-8")).hexdigest()
    return signed.upper() if upper else signed


def plain_text(html: str, limit: int = 1000) -> str:
    text = re.sub(r"<[^>]+>", "", html or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]


def first_image(images: list[str]) -> str:
    return next((u for u in images if u), "")


def price_yuan_to_fen(value: Any) -> int:
    try:
        return max(1, int(round(float(value or 0) * 100)))
    except (TypeError, ValueError):
        return 1


def now_seconds() -> int:
    return int(time.time())


def now_millis() -> int:
    return int(time.time() * 1000)
