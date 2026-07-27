"""安全模块：速率限制、安全响应头、输入清理、SSRF 防护。

提供：
- RateLimiter: 基于内存的滑动窗口速率限制
- SecurityHeadersMiddleware: 自动添加安全响应头
- sanitize_html(): XSS 防护 — HTML 清理
- sanitize_sql_like(): 转义 LIKE 通配符
- validate_url(): SSRF 防护 — URL 校验
- validate_password_strength(): 密码强度校验
"""
from __future__ import annotations

import html
import ipaddress
import re
import secrets
import time
from collections import defaultdict
from typing import Callable
from urllib.parse import urlparse

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from .config import settings


# ============================================================
# 速率限制
# ============================================================

class RateLimiter:
    """基于内存的滑动窗口速率限制器。"""

    def __init__(self) -> None:
        # {key: [timestamps]}
        self._store: dict[str, list[float]] = defaultdict(list)

    def _cleanup(self, key: str, window: float) -> None:
        now = time.monotonic()
        self._store[key] = [t for t in self._store[key] if now - t < window]

    def is_allowed(self, key: str, max_requests: int, window_seconds: float) -> bool:
        self._cleanup(key, window_seconds)
        if len(self._store[key]) >= max_requests:
            return False
        self._store[key].append(time.monotonic())
        return True

    def reset(self, key: str) -> None:
        self._store.pop(key, None)


# 全局实例
rate_limiter = RateLimiter()


# 验证码专用速率限制器：基于目标邮箱/手机号
class TargetRateLimiter:
    """基于目标的速率限制器（邮箱/手机号）。"""

    def __init__(self) -> None:
        self._store: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, target: str, max_requests: int, window_seconds: float) -> bool:
        now = time.monotonic()
        self._store[target] = [t for t in self._store.get(target, []) if now - t < window_seconds]
        if len(self._store[target]) >= max_requests:
            return False
        self._store[target].append(now)
        return True


target_rate_limiter = TargetRateLimiter()


def get_client_ip(request: Request) -> str:
    """获取客户端真实 IP（考虑反向代理）。"""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


async def rate_limit_middleware(request: Request, call_next: Callable) -> Response:
    """全局 API 速率限制中间件。"""
    # 仅限制 /api/ 路径
    url_path = request.url.path
    if not url_path.startswith("/api/"):
        return await call_next(request)

    # 使用路由路径而非 URL 路径，防止通过随机查询参数绕过
    route_path = request.scope.get("route", {}).get("path", url_path) if hasattr(request, "scope") else url_path

    # 敏感端点使用更严格的限制
    if any(route_path.startswith(p) for p in ("/api/auth/send-", "/api/auth/login", "/api/auth/register")):
        max_req = settings.rate_limit_auth_max
        window = settings.rate_limit_auth_window
    else:
        max_req = settings.rate_limit_api_max
        window = settings.rate_limit_api_window

    ip = get_client_ip(request)
    key = f"{ip}:{route_path}"

    if not rate_limiter.is_allowed(key, max_req, window):
        return JSONResponse(
            status_code=429,
            content={"detail": "请求过于频繁，请稍后再试"},
            headers={"Retry-After": str(int(window))},
        )

    return await call_next(request)


# ============================================================
# 安全响应头中间件
# ============================================================

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """为所有响应添加安全头。"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        headers = response.headers
        headers.setdefault("X-Content-Type-Options", "nosniff")
        headers.setdefault("X-Frame-Options", "DENY")
        headers.setdefault("X-XSS-Protection", "1; mode=block")
        headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        headers.setdefault("X-Permitted-Cross-Domain-Policies", "none")
        headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")

        # CSP: 允许本站 + 1688 图片 + 阿里云 CDN
        if settings.csp_header:
            headers.setdefault("Content-Security-Policy", settings.csp_header)

        # HSTS（仅生产环境 HTTPS）
        if settings.hsts_header:
            headers.setdefault("Strict-Transport-Security", settings.hsts_header)

        # 移除可能泄露框架信息的头
        headers.pop("X-Powered-By", None)
        headers.pop("Server", None)

        return response


# ============================================================
# XSS 防护
# ============================================================

# 允许的安全 HTML 标签（用于商品描述）
ALLOWED_TAGS = {"p", "br", "strong", "em", "ul", "ol", "li", "img", "a", "span", "div", "h3", "h4"}
ALLOWED_ATTRS = {"src", "href", "alt", "title", "class"}

# 允许的图片域名白名单
IMAGE_DOMAINS = {
    "cbu01.alicdn.com",
    "img.alicdn.com",
    "gw.alicdn.com",
    "i.alicdn.com",
    "ae01.alicdn.com",
    "sc01.alicdn.com",
    "api.placeholder.com",
    "via.placeholder.com",
    "placehold.co",
    "cdn.shopify.com",
}


def sanitize_html(html_str: str) -> str:
    """清理 HTML 内容，移除危险标签和属性，仅保留安全子集。

    用于商品描述中的 body_html 字段，防止 XSS 攻击。
    """
    if not html_str:
        return ""

    # 移除 <script>, <iframe>, <object>, <embed>, <style>, <link>, <meta>, <form>, <base>
    dangerous = r"</?(script|iframe|object|embed|style|link|meta|form|base|applet|frame|frameset|svg|math|video|audio|source|track)\b[^>]*>"
    cleaned = re.sub(dangerous, "", html_str, flags=re.IGNORECASE)

    # 移除事件处理器属性 (on*=)
    cleaned = re.sub(r"\s+on\w+\s*=\s*[\"'][^\"']*[\"']", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+on\w+\s*=\s*[^\s>]+", "", cleaned, flags=re.IGNORECASE)

    # 移除 javascript: 协议
    cleaned = re.sub(r"(?i)javascript\s*:", "blocked:", cleaned)
    cleaned = re.sub(r"(?i)vbscript\s*:", "blocked:", cleaned)
    cleaned = re.sub(r"(?i)data\s*:", "blocked:", cleaned)

    return cleaned


def sanitize_text(text: str) -> str:
    """纯文本清理：HTML 实体编码所有特殊字符。"""
    if not text:
        return ""
    return html.escape(text, quote=True)


# ============================================================
# SQL LIKE 注入防护
# ============================================================

def sanitize_sql_like(keyword: str) -> str:
    """转义 SQL LIKE 通配符 % 和 _，防止通配符注入攻击。"""
    if not keyword:
        return ""
    return keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


# ============================================================
# SSRF 防护
# ============================================================

# 允许的外部请求域名白名单
ALLOWED_HOSTS = {
    # 1688 / 阿里
    "detail.1688.com",
    "gw.open.1688.com",
    "cbu01.alicdn.com",
    "img.alicdn.com",
    "gw.alicdn.com",
    # Shopify
    "myshopify.com",
    "shopify.com",
    # 阿里云 API
    "dypnsapi.aliyuncs.com",
    "aliyuncs.com",
}

# 禁止的 IP 范围（内网/特殊用途）
BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("224.0.0.0/4"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def validate_url(url: str, allowed_hosts: set[str] | None = None) -> bool:
    """校验 URL 安全性，防止 SSRF 攻击。

    规则：
    1. 仅允许 http/https 协议
    2. 检查目标主机是否在内网/特殊 IP 范围内
    3. 可选：检查域名白名单
    """
    if not url:
        return False

    try:
        parsed = urlparse(url)
    except Exception:
        return False

    # 1. 仅允许 http/https
    if parsed.scheme not in ("http", "https"):
        return False

    hostname = parsed.hostname
    if not hostname:
        return False

    # 2. 检查是否内网 IP
    try:
        addr = ipaddress.ip_address(hostname)
        for net in BLOCKED_NETWORKS:
            if addr in net:
                return False
    except ValueError:
        # 不是 IP 地址，是域名，继续检查
        pass

    # 3. 域名白名单检查
    if allowed_hosts:
        hostname_lower = hostname.lower()
        # 检查精确匹配或子域名匹配
        if not any(
            hostname_lower == h or hostname_lower.endswith("." + h)
            for h in allowed_hosts
        ):
            return False

    return True


# ============================================================
# 密码强度校验
# ============================================================

def validate_password_strength(password: str) -> tuple[bool, str]:
    """校验密码强度。

    要求：至少 8 位，包含大小写字母和数字。
    返回 (是否通过, 错误信息)。
    """
    if len(password) < 8:
        return False, "密码长度至少 8 位"
    if len(password) > 128:
        return False, "密码长度不能超过 128 位"
    if not re.search(r"[a-z]", password):
        return False, "密码必须包含小写字母"
    if not re.search(r"[A-Z]", password):
        return False, "密码必须包含大写字母"
    if not re.search(r"\d", password):
        return False, "密码必须包含数字"
    return True, ""


# ============================================================
# 密钥生成
# ============================================================

def generate_secret_key(length: int = 64) -> str:
    """生成安全的随机密钥。"""
    return secrets.token_urlsafe(length)