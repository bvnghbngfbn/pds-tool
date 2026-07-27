"""数据库会话与初始化。"""
from __future__ import annotations

import secrets
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import select

from .config import DB_PATH
from . import models


engine = create_async_engine(f"sqlite+aiosqlite:///{DB_PATH}", echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_defaults()


async def seed_defaults() -> None:
    """写入默认设置项和默认管理员用户（首次启动生成随机密码）。"""
    defaults = {
        "alibaba_app_key": ("", "alibaba"),
        "alibaba_app_secret": ("", "alibaba"),
        "alibaba_access_token": ("", "alibaba"),
        "alibaba_allow_parse_fallback": ("true", "alibaba"),
        "shopify_shop_url": ("", "shopify"),
        "shopify_access_token": ("", "shopify"),
        "shopify_location_id": ("", "shopify"),
        "generic_api_url": ("", "generic"),
        "generic_api_key": ("", "generic"),
        "csv_export_dir": ("data/exports", "csv"),
        "default_markup_ratio": ("1.3", "general"),
    }
    async with AsyncSessionLocal() as db:
        for key, (val, cat) in defaults.items():
            existing = await db.get(models.Setting, key)
            if not existing:
                db.add(models.Setting(key=key, value=val, category=cat))

        # 默认管理员用户 — 首次启动生成随机安全密码
        from .auth import hash_password
        existing_admin = await db.execute(
            select(models.User).where(models.User.username == "admin")
        )
        if not existing_admin.scalar_one_or_none():
            # 生成随机密码（12 位），仅在控制台日志输出
            import logging
            logger = logging.getLogger(__name__)
            admin_password = secrets.token_urlsafe(10)
            db.add(models.User(
                username="admin",
                password_hash=hash_password(admin_password),
                role="admin",
            ))
            logger.warning("=" * 60)
            logger.warning(f"  默认管理员账号: admin")
            logger.warning(f"  默认管理员密码: {admin_password}")
            logger.warning(f"  请立即登录并修改密码！")
            logger.warning("=" * 60)

        await db.commit()


Base = models.Base


class SettingsService:
    """读写 settings 表的便捷封装。"""

    @staticmethod
    async def get(key: str, default: str = "") -> str:
        async with AsyncSessionLocal() as db:
            row = await db.get(models.Setting, key)
            return row.value if row else default

    @staticmethod
    async def get_multi(category: str | None = None) -> dict[str, str]:
        async with AsyncSessionLocal() as db:
            stmt = select(models.Setting)
            if category:
                stmt = stmt.where(models.Setting.category == category)
            result = await db.execute(stmt)
            return {r.key: r.value for r in result.scalars()}

    @staticmethod
    async def set(key: str, value: str, category: str = "general") -> None:
        async with AsyncSessionLocal() as db:
            row = await db.get(models.Setting, key)
            if row:
                row.value = value
                row.category = category
            else:
                db.add(models.Setting(key=key, value=value, category=category))
            await db.commit()

    @staticmethod
    async def set_multi(items: dict[str, str], category: str = "general") -> None:
        async with AsyncSessionLocal() as db:
            for key, value in items.items():
                row = await db.get(models.Setting, key)
                if row:
                    row.value = value
                    row.category = category
                else:
                    db.add(models.Setting(key=key, value=value, category=category))
            await db.commit()