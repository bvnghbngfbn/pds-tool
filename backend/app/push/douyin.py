"""抖音商店自动铺货 API 目标。"""
from __future__ import annotations

from .base import register_target
from .marketplace import MarketplaceApiTarget


@register_target("douyin")
class DouyinTarget(MarketplaceApiTarget):
    """抖音商店铺货目标。config: app_key, app_secret, access_token, shop_id, api_url"""

    platform_name = "抖音商店"
    id_field = "app_key"
    secret_field = "app_secret"
