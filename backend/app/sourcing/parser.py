"""1688 商品页面解析兜底。

当用户未配置 1688 开放平台凭证时，通过解析 offer 详情页提取商品数据。
1688 详情页将商品信息嵌入在 window.__INIT_DATA__ / window.runParams 等
JS 变量中，这里用正则提取并归一化。注意：站点反爬策略可能变化，
此模块为兜底方案，正式批量铺货建议使用开放平台 API。
"""
from __future__ import annotations

import json
import re
from typing import Any

import httpx

OFFER_URL = "https://detail.1688.com/offer/{offer_id}.html"

# 常见嵌入字段名
_DATA_PATTERNS = [
    re.compile(r"window\.__INIT_DATA__\s*=\s*(\{.*?\});", re.DOTALL),
    re.compile(r"window\.runParams\s*=\s*(\{.*?\});", re.DOTALL),
    re.compile(r"\"offer\"\s*:\s*(\{.*?\})\s*,\s*\"supplier\"", re.DOTALL),
]


class ParseError(Exception):
    pass


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


def _extract_images(obj: Any) -> list[str]:
    imgs: list[str] = []
    if isinstance(obj, dict):
        for k in ("imageUrls", "images", "picUrls", "imageList"):
            v = obj.get(k)
            if isinstance(v, list):
                imgs.extend([str(i) for i in v if i])
            elif isinstance(v, str) and v:
                imgs.extend([s.strip() for s in v.split(",") if s.strip()])
    elif isinstance(obj, list):
        for it in obj:
            imgs.extend(_extract_images(it))
    # 补全协议
    out = []
    for u in imgs:
        if u.startswith("//"):
            u = "https:" + u
        if u.startswith("http") and u not in out:
            out.append(u)
    return out[:8]


def _deep_find(obj: Any, keys: tuple[str, ...]) -> Any:
    """在嵌套结构中查找第一个匹配任一 key 的值。"""
    if isinstance(obj, dict):
        for k in keys:
            if k in obj and obj[k] not in (None, "", [], {}):
                return obj[k]
        for v in obj.values():
            r = _deep_find(v, keys)
            if r is not None:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = _deep_find(v, keys)
            if r is not None:
                return r
    return None


async def parse_offer(offer_id: str, timeout: float = 15.0) -> dict:
    """解析 1688 offer 详情页。"""
    url = OFFER_URL.format(offer_id=offer_id)
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        html = resp.text

    offer = _parse_html(html, offer_id)
    if not offer.get("title"):
        raise ParseError(f"无法从页面提取商品信息 (offer_id={offer_id})，可能需要登录或反爬拦截")
    return offer


def _parse_html(html: str, offer_id: str) -> dict:
    # 1) 尝试提取嵌入 JSON
    blob = None
    for pat in _DATA_PATTERNS:
        m = pat.search(html)
        if m:
            try:
                blob = json.loads(m.group(1))
                break
            except json.JSONDecodeError:
                continue

    title = ""
    price = 0.0
    stock = 0
    images: list[str] = []
    category = ""
    seller = ""

    if blob:
        title = _deep_find(blob, ("subject", "title", "offerTitle")) or ""
        price = _as_float(_deep_find(blob, ("price", "priceRanges", "unitPrice")))
        stock = _as_int(_deep_find(blob, ("quantity", "stock", "canBookCount")))
        images = _extract_images(blob)
        category = _deep_find(blob, ("categoryName", "category")) or ""
        seller = _deep_find(blob, ("supplierLoginId", "companyName", "loginId")) or ""

    # 2) 兜底：从 meta / title 标签提取
    if not title:
        m = re.search(r"<title>(.*?)</title>", html)
        if m:
            title = m.group(1).split("-阿里巴巴")[0].strip()
    if not images:
        found = re.findall(r'"(https?://cbu01\.alicdn\.com/[^"]+\.(?:jpg|jpeg|png|webp))"', html)
        images = list(dict.fromkeys(found))[:8]

    return {
        "offer_id": offer_id,
        "title": title,
        "price": price,
        "stock": stock,
        "image_urls": images,
        "category": category,
        "seller": seller,
        "url": url,
        "specs": [],
        "raw": {},
    }


def extract_offer_id(text: str) -> str:
    """从 URL 或文本中提取 offerId。"""
    m = re.search(r"offer/(\d+)", text) or re.search(r"(\d{6,})", text)
    return m.group(1) if m else text.strip()
