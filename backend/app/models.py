"""SQLAlchemy 数据模型。

核心实体：
- Product: 从 1688 选品入库的商品（源数据 + 转换后数据）
- PushTask: 铺货任务（一次/定时，关联目标平台与商品筛选条件）
- PushRecord: 单条商品铺货执行记录
- Setting: 平台凭证与全局参数（KV）
- TaskLog: 任务执行日志
- User: 系统用户
- LoginRecord: 登录记录
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
    SOURCED = "sourced"        # 已采集入库
    MAPPED = "mapped"          # 字段映射完成
    PENDING = "pending"        # 待铺货
    PUSHED = "pushed"          # 已铺货
    FAILED = "failed"
    ARCHIVED = "archived"


class PushTaskType(str, enum.Enum):
    ONCE = "once"              # 立即/一次性
    SCHEDULED = "scheduled"    # 定时

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
    source_offer_id: Mapped[str] = mapped_column(String(64), index=True)  # 1688 offerId
    source_url: Mapped[str] = mapped_column(Text, default="")
    title: Mapped[str] = mapped_column(String(512), default="")
    status: Mapped[str] = mapped_column(String(32), default=ProductStatus.SOURCED.value, index=True)

    # 1688 原始数据
    raw_data: Mapped[dict] = mapped_column(JSON, default=dict)
    # 转换后用于铺货的数据
    mapped_data: Mapped[dict] = mapped_column(JSON, default=dict)

    price: Mapped[float] = mapped_column(Float, default=0.0)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    image_urls: Mapped[str] = mapped_column(Text, default="")  # JSON string
    category_source: Mapped[str] = mapped_column(String(128), default="")
    category_target: Mapped[str] = mapped_column(String(128), default="")

    tags: Mapped[str] = mapped_column(String(256), default="")
    markup_ratio: Mapped[float] = mapped_column(Float, default=1.0)  # 加价倍率
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
    target_config: Mapped[dict] = mapped_column(JSON, default=dict)  # 目标平台连接配置

    # 商品筛选条件
    filter_category: Mapped[str] = mapped_column(String(128), default="")
    filter_keyword: Mapped[str] = mapped_column(String(128), default="")
    filter_tags: Mapped[str] = mapped_column(String(256), default="")
    filter_status: Mapped[str] = mapped_column(String(32), default=ProductStatus.PENDING.value)
    limit: Mapped[int] = mapped_column(Integer, default=50)

    # 加价与映射策略
    markup_ratio: Mapped[float] = mapped_column(Float, default=1.3)
    auto_map_category: Mapped[bool] = mapped_column(Boolean, default=True)

    # 定时配置
    cron_expr: Mapped[str] = mapped_column(String(64), default="")  # 空=不调度
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
    role: Mapped[str] = mapped_column(String(16), default=UserRole.USER.value)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    login_records: Mapped[list["LoginRecord"]] = relationship(back_populates="user")


class LoginRecord(Base):
    __tablename__ = "login_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(64), default="")
    ip_address: Mapped[str] = mapped_column(String(64), default="")
    user_agent: Mapped[str] = mapped_column(String(512), default="")
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    message: Mapped[str] = mapped_column(String(256), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    user: Mapped["User"] = relationship(back_populates="login_records")
