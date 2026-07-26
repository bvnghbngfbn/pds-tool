"""认证 API：登录、注册、获取当前用户、登录记录。"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc

from ..auth import (
    create_access_token,
    decode_token,
    get_current_user,
    hash_password,
    verify_password,
)
from ..db import AsyncSessionLocal
from ..models import User, LoginRecord

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------- 请求/响应模型 ----------

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=4, max_length=128)


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=4, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


class UserInfo(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    created_at: str
    last_login_at: str | None


class LoginRecordItem(BaseModel):
    id: int
    username: str
    ip_address: str
    user_agent: str
    success: bool
    message: str
    created_at: str


# ---------- 辅助函数 ----------

async def _record_login(
    user_id: int,
    username: str,
    request: Request,
    success: bool,
    message: str = "",
) -> None:
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    ip = ip.split(",")[0].strip()
    ua = request.headers.get("user-agent", "")[:512]
    async with AsyncSessionLocal() as db:
        db.add(LoginRecord(
            user_id=user_id,
            username=username,
            ip_address=ip,
            user_agent=ua,
            success=success,
            message=message,
        ))
        await db.commit()


# ---------- 端点 ----------

@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest, request: Request):
    """注册新用户。"""
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.username == body.username))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名已存在")

        user = User(
            username=body.username,
            password_hash=hash_password(body.password),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        await _record_login(user.id, user.username, request, True, "注册并登录")

        token = create_access_token({"sub": user.username, "role": user.role})
        return TokenResponse(
            access_token=token,
            username=user.username,
            role=user.role,
        )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request):
    """用户登录。"""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == body.username))
        user = result.scalar_one_or_none()

        if not user or not verify_password(body.password, user.password_hash):
            # 记录失败（如果用户存在）
            if user:
                await _record_login(user.id, body.username, request, False, "密码错误")
            else:
                # 为不存在的用户也记录（用 user_id=0）
                ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
                ip = ip.split(",")[0].strip()
                ua = request.headers.get("user-agent", "")[:512]
                async with AsyncSessionLocal() as db2:
                    db2.add(LoginRecord(
                        user_id=0, username=body.username, ip_address=ip,
                        user_agent=ua, success=False, message="用户不存在",
                    ))
                    await db2.commit()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")

        if not user.is_active:
            await _record_login(user.id, user.username, request, False, "账号已禁用")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已被禁用")

        # 更新最后登录时间
        user.last_login_at = datetime.now(timezone.utc)
        await db.commit()

        await _record_login(user.id, user.username, request, True, "登录成功")

        token = create_access_token({"sub": user.username, "role": user.role})
        return TokenResponse(
            access_token=token,
            username=user.username,
            role=user.role,
        )


@router.get("/me", response_model=UserInfo)
async def me(current_user: User = Depends(get_current_user)):
    """获取当前登录用户信息。"""
    return UserInfo(
        id=current_user.id,
        username=current_user.username,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at.isoformat() if current_user.created_at else "",
        last_login_at=current_user.last_login_at.isoformat() if current_user.last_login_at else None,
    )


@router.get("/login-records")
async def get_login_records(
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_current_user),
):
    """查看登录记录（仅管理员可查看全部，普通用户只看自己的）。"""
    async with AsyncSessionLocal() as db:
        if current_user.role == "admin":
            # 管理员查看全部
            total_stmt = select(func.count(LoginRecord.id))
            total_result = await db.execute(total_stmt)
            total = total_result.scalar() or 0

            stmt = (
                select(LoginRecord)
                .order_by(desc(LoginRecord.created_at))
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        else:
            # 普通用户只看自己的
            total_stmt = select(func.count(LoginRecord.id)).where(LoginRecord.user_id == current_user.id)
            total_result = await db.execute(total_stmt)
            total = total_result.scalar() or 0

            stmt = (
                select(LoginRecord)
                .where(LoginRecord.user_id == current_user.id)
                .order_by(desc(LoginRecord.created_at))
                .offset((page - 1) * page_size)
                .limit(page_size)
            )

        result = await db.execute(stmt)
        records = result.scalars().all()

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": [
                {
                    "id": r.id,
                    "username": r.username,
                    "ip_address": r.ip_address,
                    "user_agent": r.user_agent,
                    "success": r.success,
                    "message": r.message,
                    "created_at": r.created_at.isoformat() if r.created_at else "",
                }
                for r in records
            ],
        }


@router.get("/login-stats")
async def get_login_stats(current_user: User = Depends(get_current_user)):
    """登录统计概览。"""
    async with AsyncSessionLocal() as db:
        # 总登录次数
        total_result = await db.execute(select(func.count(LoginRecord.id)))
        total = total_result.scalar() or 0

        # 成功次数
        success_result = await db.execute(
            select(func.count(LoginRecord.id)).where(LoginRecord.success == True)
        )
        success = success_result.scalar() or 0

        # 今日登录次数
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_result = await db.execute(
            select(func.count(LoginRecord.id)).where(LoginRecord.created_at >= today)
        )
        today_count = today_result.scalar() or 0

        # 用户总数
        user_result = await db.execute(select(func.count(User.id)))
        user_count = user_result.scalar() or 0

        # 最近登录记录
        recent_stmt = (
            select(LoginRecord)
            .order_by(desc(LoginRecord.created_at))
            .limit(10)
        )
        recent_result = await db.execute(recent_stmt)
        recent = recent_result.scalars().all()

        return {
            "total_logins": total,
            "success_logins": success,
            "failed_logins": total - success,
            "today_logins": today_count,
            "total_users": user_count,
            "recent": [
                {
                    "id": r.id,
                    "username": r.username,
                    "ip_address": r.ip_address,
                    "success": r.success,
                    "message": r.message,
                    "created_at": r.created_at.isoformat() if r.created_at else "",
                }
                for r in recent
            ],
        }