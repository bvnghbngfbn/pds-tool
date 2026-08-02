"""Cloudflare Turnstile 人机验证。"""
from __future__ import annotations

import logging

import httpx
from fastapi import HTTPException, Request, status

from .config import settings

logger = logging.getLogger(__name__)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


async def verify_turnstile_or_raise(token: str, request: Request) -> None:
    """严格校验 Turnstile token；未启用时跳过，便于本地开发。"""
    if not settings.turnstile_enabled:
        return
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先完成人机验证",
        )

    payload = {
        "secret": settings.turnstile_secret_key,
        "response": token,
        "remoteip": _client_ip(request),
    }
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.post(settings.turnstile_verify_url, data=payload)
            data = resp.json()
    except Exception as e:
        logger.warning("Turnstile 校验服务异常: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="人机验证服务暂不可用，请稍后再试",
        ) from e

    if not data.get("success"):
        logger.warning("Turnstile 校验失败: %s", data.get("error-codes"))
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="人机验证失败，请刷新后重试",
        )
