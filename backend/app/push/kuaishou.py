"""快手小店自动铺货 API 目标。"""
from __future__ import annotations

from .base import register_target
from .marketplace import MarketplaceApiTarget


@register_target("kuaishou")
class KuaishouTarget(MarketplaceApiTarget):
    """快手小店铺货目标。config: app_id, app_secret, access_token, shop_id, api_url"""

    platform_name = "快手小店"
    id_field = "app_id"
    secret_field = "app_secret"
