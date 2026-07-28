"""应用配置：管理 1688 / 目标平台凭证与运行参数。

凭证以 SQLite settings 表持久化（加密可选），运行时通过 SettingsService 读写。
这里只定义静态配置项与默认值。
"""
from __future__ import annotations

import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

import secrets


def _generate_secret_key(length: int = 64) -> str:
    return secrets.token_urlsafe(length)


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "pds.db"
STATIC_DIR = BASE_DIR / "static"


class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="PDS_", env_file=".env", extra="ignore")

    # 1688 开放平台（用户在设置页填入，这里仅给默认占位/环境变量入口）
    alibaba_app_key: str = ""
    alibaba_app_secret: str = ""
    alibaba_redirect_uri: str = "http://localhost:8000/api/oauth/alibaba/callback"
    allow_parse_fallback: bool = True

    # 任务调度
    scheduler_enabled: bool = True
    scheduler_interval_seconds: int = 60

    # ============ 安全配置 ============

    # 应用密钥（自动生成随机密钥，也可通过环境变量覆盖）
    secret_key: str = os.getenv("PDS_SECRET_KEY", _generate_secret_key())

    # CORS — 生产环境必须通过环境变量指定具体域名，逗号分隔
    cors_origins: str = os.getenv("PDS_CORS_ORIGINS", "")

    # JWT（自动生成，也可通过环境变量覆盖）
    jwt_secret_key: str = os.getenv("PDS_JWT_SECRET_KEY", _generate_secret_key())
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 小时

    # 安全响应头
    csp_header: str = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self'; "
        "font-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )
    hsts_header: str = "max-age=31536000; includeSubDomains; preload"

    # 速率限制
    rate_limit_auth_max: int = 10     # 认证接口每分钟最多请求数
    rate_limit_auth_window: int = 60  # 窗口（秒）
    rate_limit_api_max: int = 120     # 普通 API 接口每分钟最多请求数
    rate_limit_api_window: int = 60

    # 账户安全
    max_login_attempts: int = 5       # 最大登录失败次数
    login_lockout_minutes: int = 15   # 锁定时间（分钟）

    # SMTP 邮件
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True

    # 阿里云短信认证（号码认证服务）
    aliyun_access_key_id: str = ""
    aliyun_access_key_secret: str = ""
    aliyun_sms_sign_name: str = "恒创联众"
    aliyun_sms_template_code: str = "SMS_337450304"

    # 验证码有效期（分钟）
    verify_code_expire_minutes: int = 5

    # 服务
    host: str = "0.0.0.0"
    port: int = 8000

    @property
    def cors_origin_list(self) -> list[str]:
        """解析 CORS 来源列表。"""
        if not self.cors_origins:
            return ["http://localhost:5173", "http://localhost:8000"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = AppConfig()