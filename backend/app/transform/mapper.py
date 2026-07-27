"""商品数据转换：1688 源数据 → 目标平台铺货数据。

- 字段映射：标题/价格/库存/图片/描述
- 加价策略：按倍率计算目标售价
- 类目映射：源类目 → 目标类目（基于关键词规则表）
- 标题优化：去除 1688 站内营销词，拼装目标平台风格标题
- XSS 防护：描述 HTML 通过安全清理
"""
from __future__ import annotations

import json
import re
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..security import sanitize_html

# 1688 标题常见营销噪音词，铺货时清理
_NOISE_WORDS = [
    "厂家直销", "一手货源", "微商爆款", "地摊", "批发价", "源头工厂",
    "代发", "一件代发", "现货", "新品", "热销", "低价", "特价",
    "淘宝同款", "天猫同款", "拼多多同款", "9.9", "包邮",
]

# 类目映射规则：(源关键词列表, 目标类目)
CATEGORY_RULES: list[tuple[list[str], str]] = [
    (["手机壳", "保护套", "硅胶壳"], "手机配件/保护壳"),
    (["数据线", "充电线", "Type-C"], "数码配件/数据线"),
    (["耳机", "蓝牙耳机", "头戴"], "数码配件/耳机"),
    (["女装", "连衣裙", "T恤", "衬衫"], "服装/女装"),
    (["男装", "夹克", "卫衣"], "服装/男装"),
    (["鞋", "运动鞋", "休闲鞋"], "鞋靴"),
    (["包", "手提包", "双肩包"], "箱包"),
    (["家居", "收纳", "置物架"], "家居日用"),
    (["美妆", "口红", "面膜"], "美妆个护"),
    (["玩具", "积木", "毛绒"], "玩具"),
    (["母婴", "奶瓶", "婴儿"], "母婴用品"),
    (["食品", "零食", "干货"], "食品"),
]


def clean_title(title: str) -> str:
    """清理 1688 标题噪音词，压缩多余空白。"""
    if not title:
        return ""
    t = title
    for w in sorted(_NOISE_WORDS, key=len, reverse=True):
        t = t.replace(w, "")
    t = re.sub(r"【.*?】", "", t)
    t = re.sub(r"\[.*?\]", "", t)
    t = re.sub(r"\s+", " ", t).strip(" -|/【】[]")
    return t or title


def map_category(source_category: str, title: str = "") -> str:
    """根据源类目与标题关键词推断目标类目。"""
    text = f"{source_category} {title}"
    for keywords, target in CATEGORY_RULES:
        if any(k in text for k in keywords):
            return target
    return source_category or "未分类"


def compute_price(source_price: float, markup_ratio: float) -> float:
    """按加价倍率计算目标售价，保留两位小数。"""
    if source_price <= 0:
        return 0.0
    target = source_price * markup_ratio
    return round(target, 0) - 0.1 if target > 10 else round(target, 2)


def transform(raw: dict, markup_ratio: float = 1.3, auto_map: bool = True,
              target_category: str = "") -> dict:
    """将 1688 原始数据转换为铺货数据。"""
    title = raw.get("title", "")
    images = raw.get("image_urls", []) or []
    source_cat = raw.get("category", "")

    mapped_title = clean_title(title)
    cat = target_category or (map_category(source_cat, title) if auto_map else source_cat)
    price = compute_price(float(raw.get("price", 0) or 0), markup_ratio)

    # 构建并清理描述 HTML（XSS 防护）
    body_html = _build_description(raw, images)
    body_html = sanitize_html(body_html)

    return {
        "title": mapped_title,
        "original_title": title,
        "body_html": body_html,
        "price": f"{price:.2f}",
        "source_price": float(raw.get("price", 0) or 0),
        "markup_ratio": markup_ratio,
        "inventory": int(raw.get("stock", 0) or 0),
        "images": images,
        "category": cat,
        "source_category": source_cat,
        "seller": raw.get("seller", ""),
        "specs": raw.get("specs", []) or [],
        "source_url": raw.get("url", ""),
        "offer_id": raw.get("offer_id", ""),
    }


def _build_description(raw: dict, images: list[str]) -> str:
    """生成商品描述 HTML（纯文本内容，不包含 raw 中的 HTML）。"""
    parts = [f"<p><strong>{clean_title(raw.get('title', ''))}</strong></p>"]
    if raw.get("specs"):
        parts.append("<p><strong>规格参数</strong></p><ul>")
        for s in raw["specs"][:20]:
            if isinstance(s, dict):
                parts.append(f"<li>{s.get('name','')}: {s.get('value','')}</li>")
            else:
                parts.append(f"<li>{s}</li>")
        parts.append("</ul>")
    parts.append(f"<p>货源: 1688 ({raw.get('seller', '')})</p>")
    if images:
        parts.append("<p><strong>商品图片</strong></p>")
        for u in images:
            parts.append(f'<p><img src="{u}" /></p>')
    return "".join(parts)


async def map_product(db: AsyncSession, product_id: int, markup_ratio: float = 1.3,
                      auto_map: bool = True, target_category: str = "") -> models.Product:
    """对单个商品执行转换并落库。"""
    product = await db.get(models.Product, product_id)
    if not product:
        raise ValueError("商品不存在")
    mapped = transform(product.raw_data or {}, markup_ratio, auto_map, target_category)
    product.mapped_data = mapped
    product.markup_ratio = markup_ratio
    product.category_target = mapped["category"]
    product.status = models.ProductStatus.MAPPED.value
    from datetime import datetime
    product.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(product)
    return product


async def map_batch(db: AsyncSession, product_ids: list[int], markup_ratio: float = 1.3,
                    auto_map: bool = True) -> int:
    """批量转换。返回成功数。"""
    count = 0
    for pid in product_ids:
        try:
            await map_product(db, pid, markup_ratio, auto_map)
            count += 1
        except Exception:
            continue
    return count


def get_image_list(product: models.Product) -> list[str]:
    try:
        return json.loads(product.image_urls) if product.image_urls else []
    except (json.JSONDecodeError, TypeError):
        return []