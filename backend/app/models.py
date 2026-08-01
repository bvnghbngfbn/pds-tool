"""SQLAlchemy 数据模型。

核心实体：
- Product: 从 1688 选品入库的商品（源数据 + 转换后数据）
- PushTask: 铺货任务（一次/定时，关联目标平台与商品筛选条件）
- PushRecord: 单条商品铺货执行记录
- Setting: 平台凭证与全局参数（KV）
- TaskLog: 任务执行日志
- User: 系统用户（含账户锁定字段）
- LoginRecord: 登录记录
- VerificationCode: 验证码
"""
from __future__ import annotations

import enum
import json
from datetime import datetime
from sqlalchemy import (
    String, Integer, Text, DateTime, ForeignKey, Boolean, JSON, Enum, Float
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class ProductStatus(str, enum.Enum):
    SOURCED = "sourced"
    MAPPED = "mapped"
    PENDING = "pending"
    PUSHED = "pushed"
    FAILED = "failed"
    ARCHIVED = "archived"


class PushTaskType(str, enum.Enum):
    ONCE = "once"
    SCHEDULED = "scheduled"

class PushTaskStatus(str, enum.Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    DONE = "done"
    ERROR = "error"

class PushTargetType(str, enum.Enum):
    SHOPIFY = "shopify"
    GENERIC = "generic"
    CSV = "csv"

class PushRecordStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_offer_id: Mapped[str] = mapped_column(String(64), index=True)
    source_url: Mapped[str] = mapped_column(Text, default="")
    title: Mapped[str] = mapped_column(String(512), default="")
    status: Mapped[str] = mapped_column(String(32), default=ProductStatus.SOURCED.value, index=True)

    raw_data: Mapped[dict] = mapped_column(JSON, default=dict)
    mapped_data: Mapped[dict] = mapped_column(JSON, default=dict)

    price: Mapped[float] = mapped_column(Float, default=0.0)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    image_urls: Mapped[str] = mapped_column(Text, default="")
    category_source: Mapped[str] = mapped_column(String(128), default="")
    category_target: Mapped[str] = mapped_column(String(128), default="")

    tags: Mapped[str] = mapped_column(String(256), default="")
    markup_ratio: Mapped[float] = mapped_column(Float, default=1.0)
    source_seller: Mapped[str] = mapped_column(String(128), default="")

    error: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    records: Mapped[list["PushRecord"]] = relationship(back_populates="product")


class PushTask(Base):
    __tablename__ = "push_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), default="")
    task_type: Mapped[str] = mapped_column(String(16), default=PushTaskType.ONCE.value)
    status: Mapped[str] = mapped_column(String(16), default=PushTaskStatus.IDLE.value, index=True)

    target_type: Mapped[str] = mapped_column(String(16), default=PushTargetType.SHOPIFY.value)
    target_config: Mapped[dict] = mapped_column(JSON, default=dict)

    filter_category: Mapped[str] = mapped_column(String(128), default="")
    filter_keyword: Mapped[str] = mapped_column(String(128), default="")
    filter_tags: Mapped[str] = mapped_column(String(256), default="")
    filter_status: Mapped[str] = mapped_column(String(32), default=ProductStatus.PENDING.value)
    limit: Mapped[int] = mapped_column(Integer, default=50)

    markup_ratio: Mapped[float] = mapped_column(Float, default=1.3)
    auto_map_category: Mapped[bool] = mapped_column(Boolean, default=True)

    cron_expr: Mapped[str] = mapped_column(String(64), default="")
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    total: Mapped[int] = mapped_column(Integer, default=0)
    success: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    records: Mapped[list["PushRecord"]] = relationship(back_populates="task")


class PushRecord(Base):
    __tablename__ = "push_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("push_tasks.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    status: Mapped[str] = mapped_column(String(16), default=PushRecordStatus.PENDING.value)
    target_item_id: Mapped[str] = mapped_column(String(128), default="")
    target_item_url: Mapped[str] = mapped_column(Text, default="")
    message: Mapped[str] = mapped_column(Text, default="")
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    task: Mapped["PushTask"] = relationship(back_populates="records")
    product: Mapped["Product"] = relationship(back_populates="records")


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(32), default="general", index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TaskLog(Base):
    __tablename__ = "task_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    level: Mapped[str] = mapped_column(String(16), default="INFO")
    message: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    email: Mapped[str] = mapped_column(String(128), default="", index=True)
    phone: Mapped[str] = mapped_column(String(32), default="", index=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    role: Mapped[str] = mapped_column(String(16), default=UserRole.USER.value)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # 账户安全
    login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    login_records: Mapped[list["LoginRecord"]] = relationship(back_populates="user")


class VerificationCode(Base):
    __tablename__ = "verification_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    target: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(8), nullable=False)
    code_type: Mapped[str] = mapped_column(String(16), default="email")
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class LoginRecord(Base):
    __tablename__ = "login_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    username: Mapped[str] = mapped_column(String(64), default="")
    ip_address: Mapped[str] = mapped_column(String(64), default="")
    user_agent: Mapped[str] = mapped_column(String(512), default="")
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    message: Mapped[str] = mapped_column(String(256), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    user: Mapped["User"] = relationship(back_populates="login_records")