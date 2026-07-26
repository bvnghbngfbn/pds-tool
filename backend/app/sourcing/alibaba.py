"""1688 开放平台 API 客户端。

实现阿里开放平台标准签名算法（MD5），封装商品搜索与详情接口。
用户在设置页填入 App Key / App Secret / Access Token 后即可真实调用。
无凭证时上层 service 会降级到页面解析（parser.py）。

参考：阿里开放平台网关 https://gw.open.1688.com/openapi/
签名规则：将所有请求参数按键名升序拼接，首尾拼接 App Secret，MD5 大写。
"""
from __future__ import annotations

import hashlib
import time
import urllib.parse
from typing import Any

import httpx

GATEWAY = "https://gw.open.1688.com/openapi"
# 1688 商品相关 API（namespace / method / version）
# 实际可用 method 取决于 ISV 应用授权，这里给主流默认值，可在设置页覆盖
DEFAULT_METHODS = {
    "search": "alibaba.icbu.product.search",      # 商品搜索
    "detail": "alibaba.icbu.product.get",         # 商品详情
    "category": "alibaba.icbu.category.list",     # 类目列表
}


class AlibabaClientError(Exception):
    pass


class AlibabaClient:
    """1688 开放平台客户端。"""

    def __init__(
        self,
        app_key: str,
        app_secret: str,
        access_token: str = "",
        timeout: float = 20.0,
    ) -> None:
        self.app_key = app_key
        self.app_secret = app_secret
        self.access_token = access_token
        self.timeout = timeout
        self._http = httpx.AsyncClient(timeout=timeout)

    @property
    def configured(self) -> bool:
        return bool(self.app_key and self.app_secret)

    # ---------- 签名 ----------
    def _sign(self, params: dict[str, Any]) -> str:
        """阿里开放平台签名：参数升序拼接，首尾加 secret，MD5 大写。"""
        items = sorted((k, str(v)) for k, v in params.items() if v is not None and v != "")
        joined = "".join(f"{k}{v}" for k, v in items)
        raw = self.app_secret + joined + self.app_secret
        return hashlib.md5(raw.encode("utf-8")).hexdigest().upper()

    def _build_url(self, method: str, namespace: str = "com.alibaba.product", version: str = "1.0.0") -> str:
        # param2/{version}/{namespace}/{method}/
        return f"{GATEWAY}/param2/{version}/{namespace}/{method}/"

    def _common_params(self) -> dict[str, Any]:
        return {
            "appKey": self.app_key,
            "signMethod": "md5",
            "timestamp": _now_ms(),
            "format": "json",
            "v": "1.0",
            "language": "zh_CN",
            "access_token": self.access_token,
        }

    async def _call(self, method: str, namespace: str, biz_params: dict[str, Any]) -> dict:
        if not self.configured:
            raise AlibabaClientError("1688 App Key/Secret 未配置，请在设置页填写")
        params = self._common_params()
        params.update(biz_params)
        params["sign"] = self._sign(params)
        url = self._build_url(method, namespace)
        resp = await self._http.post(url, data=params)
        resp.raise_for_status()
        data = resp.json()
        # 阿里返回统一带 errorCode/errorMessage；成功时 errorCode 为 00000000 或无
        if isinstance(data, dict) and data.get("errorCode") and data["errorCode"] != "00000000":
            raise AlibabaClientError(f"[{data.get('errorCode')}] {data.get('errorMessage')}")
        return data

    # ---------- 业务接口 ----------
    async def search_products(
        self,
        keyword: str = "",
        category_id: str = "",
        page: int = 1,
        page_size: int = 20,
        sort: str = "va",  # va:综合, wp:价格升, wd:价格降, rz:销量
        price_min: float | None = None,
        price_max: float | None = None,
    ) -> dict:
        """搜索 1688 商品。"""
        biz = {
            "keywords": keyword,
            "categoryId": category_id,
            "beginPage": page,
            "pageSize": min(page_size, 50),
            "sortType": sort,
        }
        if price_min is not None:
            biz["priceStart"] = price_min
        if price_max is not None:
            biz["priceEnd"] = price_max
        method = DEFAULT_METHODS["search"]
        namespace = "com.alibaba.product"
        data = await self._call(method, namespace, biz)
        return _normalize_search(data)

    async def get_product_detail(self, offer_id: str) -> dict:
        """获取商品详情。"""
        biz = {"productID": offer_id}
        method = DEFAULT_METHODS["detail"]
        data = await self._call(method, "com.alibaba.product", biz)
        return _normalize_detail(data)

    async def close(self) -> None:
        await self._http.aclose()


# ---------- 归一化 ----------
def _now_ms() -> str:
    return str(int(time.time() * 1000))


def _as_float(v: Any, default: float = 0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _as_int(v: Any, default: int = 0) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return default


def _normalize_search(data: dict) -> dict:
    """将 1688 搜索返回归一化为统一结构。兼容多种返回字段名。"""
    root = data.get("result") or data.get("products") or data.get("data") or data
    items_raw = (
        root.get("products") or root.get("productInfo") or root.get("list") or root.get("items") or []
    )
    items = []
    for it in items_raw:
        offer_id = str(it.get("productID") or it.get("offerId") or it.get("id") or "")
        images = it.get("imageUrls") or it.get("images") or []
        if isinstance(images, str):
            images = [i.strip() for i in images.split(",") if i.strip()]
        items.append({
            "offer_id": offer_id,
            "title": it.get("subject") or it.get("title") or "",
            "price": _as_float(it.get("priceRanges", {}).get("price") if isinstance(it.get("priceRanges"), dict) else it.get("price")),
            "stock": _as_int(it.get("quantity") or it.get("stock")),
            "image_urls": images[:8],
            "category": it.get("categoryName") or it.get("category") or "",
            "seller": it.get("supplierLoginId") or it.get("companyName") or "",
            "url": f"https://detail.1688.com/offer/{offer_id}.html" if offer_id else "",
        })
    total = root.get("totalCount") or root.get("total") or len(items)
    return {"items": items, "total": _as_int(total), "page": _as_int(root.get("page"))}


def _normalize_detail(data: dict) -> dict:
    """将商品详情归一化。"""
    p = data.get("productInfo") or data.get("result") or data.get("data") or data.get("product") or data
    images = p.get("imageUrls") or p.get("images") or p.get("picUrl") or []
    if isinstance(images, str):
        images = [i.strip() for i in images.split(",") if i.strip()]
    specs = p.get("productFeature") or p.get("attributes") or p.get("specs") or []
    offer_id = str(p.get("productID") or p.get("offerId") or p.get("id") or "")
    return {
        "offer_id": offer_id,
        "title": p.get("subject") or p.get("title") or "",
        "price": _as_float(p.get("priceRanges", {}).get("price") if isinstance(p.get("priceRanges"), dict) else p.get("price")),
        "stock": _as_int(p.get("quantity") or p.get("stock")),
        "image_urls": images[:8],
        "category": p.get("categoryName") or p.get("category") or "",
        "seller": p.get("supplierLoginId") or p.get("companyName") or "",
        "url": f"https://detail.1688.com/offer/{offer_id}.html" if offer_id else "",
        "desc_url": p.get("description") or p.get("detailUrl") or "",
        "specs": specs,
        "raw": p,
    }
