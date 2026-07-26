"""CSV 批量导出铺货目标。

将商品按通用电商批量导入格式导出为 CSV，兼容淘宝/拼多多等平台的批量上传模板
（核心字段对齐：标题、价格、库存、图片URL、类目、SKU、描述）。
每次任务运行输出一个带时间戳的 CSV 文件。
"""
from __future__ import annotations

import csv
import os
from datetime import datetime
from typing import Any

from ..config import DATA_DIR
from .base import PushTarget, PushResult, register_target

CSV_COLUMNS = [
    "title", "price", "stock", "image_urls", "category", "sku",
    "description", "source_url", "source_price", "markup_ratio",
]


@register_target("csv")
class CsvTarget(PushTarget):
    """CSV 导出目标。config: export_dir(可选)"""

    def __init__(self, config: dict[str, Any]) -> None:
        super().__init__(config)
        self.export_dir = config.get("export_dir") or str(DATA_DIR / "exports")
        os.makedirs(self.export_dir, exist_ok=True)
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        self.filepath = os.path.join(self.export_dir, f"pds_export_{ts}.csv")
        self._fh = open(self.filepath, "w", newline="", encoding="utf-8-sig")
        self._writer = csv.writer(self._fh)
        self._writer.writerow(CSV_COLUMNS)
        self._count = 0

    async def push(self, mapped_data: dict) -> PushResult:
        try:
            row = [
                mapped_data.get("title", ""),
                mapped_data.get("price", ""),
                int(mapped_data.get("inventory", 0) or 0),
                "|".join(mapped_data.get("images", []) or []),
                mapped_data.get("category", ""),
                f"1688-{mapped_data.get('offer_id', '')}",
                mapped_data.get("body_html", "")[:2000],
                mapped_data.get("source_url", ""),
                mapped_data.get("source_price", ""),
                mapped_data.get("markup_ratio", ""),
            ]
            self._writer.writerow(row)
            self._fh.flush()
            self._count += 1
            return PushResult(True, target_item_id=str(self._count),
                              target_item_url=f"file://{self.filepath}",
                              message=f"已写入 CSV ({self._count} 条)", payload={"row": row})
        except Exception as e:  # noqa: BLE001
            return PushResult(False, message=f"CSV 写入失败: {e}")

    async def close(self) -> None:
        try:
            self._fh.close()
        except Exception:  # noqa: BLE001
            pass
