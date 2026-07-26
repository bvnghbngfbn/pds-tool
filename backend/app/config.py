"""应用配置：管理 1688 / 目标平台凭证与运行参数。

凭证以 SQLite settings 表持久化（加密可选），运行时通过 SettingsService 读写。
这里只定义静态配置项与默认值。
"""
from __future__ import annotations

import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    # 是否在没有凭证时降级到页面解析
    allow_parse_fallback: bool = True

    # 任务调度
    scheduler_enabled: bool = True
    scheduler_interval_seconds: int = 60  # 调度器扫描间隔

    # 安全
    secret_key: str = "change-me-in-production"
    cors_origins: list[str] = ["*"]

    # 服务
    host: str = "0.0.0.0"
    port: int = 8000


settings = AppConfig()
