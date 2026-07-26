"""铺货目标基类与注册表。"""
from __future__ import annotations

import abc
from typing import Any


class PushResult:
    def __init__(self, success: bool, target_item_id: str = "", target_item_url: str = "",
                 message: str = "", payload: dict | None = None) -> None:
        self.success = success
        self.target_item_id = target_item_id
        self.target_item_url = target_item_url
        self.message = message
        self.payload = payload or {}


class PushTarget(abc.ABC):
    """铺货目标抽象。"""

    type_name: str = "base"

    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config

    @abc.abstractmethod
    async def push(self, mapped_data: dict) -> PushResult:
        """将转换后的商品数据推送到目标平台。"""
        ...

    async def close(self) -> None:
        pass


_REGISTRY: dict[str, type[PushTarget]] = {}


def register_target(name: str) -> type:
    def deco(cls: type[PushTarget]) -> type[PushTarget]:
        cls.type_name = name
        _REGISTRY[name] = cls
        return cls
    return deco


def get_target(target_type: str, config: dict[str, Any]) -> PushTarget:
    cls = _REGISTRY.get(target_type)
    if not cls:
        raise ValueError(f"不支持的铺货目标类型: {target_type}")
    return cls(config)
