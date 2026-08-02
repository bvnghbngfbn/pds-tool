"""拼多多自动铺货 API 目标。"""
from __future__ import annotations

from .base import register_target
from .marketplace import MarketplaceApiTarget


@register_target("pdd")
class PddTarget(MarketplaceApiTarget):
    """拼多多铺货目标。config: client_id, client_secret, access_token, mall_id, api_url"""

    platform_name = "拼多多"
    id_field = "client_id"
    secret_field = "client_secret"
