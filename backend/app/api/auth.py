"""认证 API：登录、注册、获取当前用户、登录记录、验证码。"""
from __future__ import annotations

import re
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
from ..verify_service import (
    send_email_code,
    send_sms_code,
    verify_email_code,
    verify_sms_code,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------- 请求/响应模型 ----------

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=4, max_length=128)


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=4, max_length=128)


class SendEmailCodeRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=128)


class SendSmsCodeRequest(BaseModel):
    phone: str = Field(..., min_length=11, max_length=20)


class EmailRegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=128)
    code: str = Field(..., min_length=6, max_length=6)
    password: str = Field(..., min_length=4, max_length=128)


class PhoneRegisterRequest(BaseModel):
    phone: str = Field(..., min_length=11, max_length=20)
    code: str = Field(..., min_length=6, max_length=6)
    password: str = Field(..., min_length=4, max_length=128)


class EmailLoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=128)
    code: str = Field(..., min_length=6, max_length=6)


class PhoneLoginRequest(BaseModel):
    phone: str = Field(..., min_length=11, max_length=20)
    code: str = Field(..., min_length=6, max_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


class UserInfo(BaseModel):
    id: int
    username: str
    email: str = ""
    phone: str = ""
    email_verified: bool = False
    phone_verified: bool = False
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

EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
PHONE_RE = re.compile(r"^\+?\d{7,20}$")


def _make_token_response(user: User) -> TokenResponse:
    token = create_access_token({"sub": user.username, "role": user.role})
    return TokenResponse(
        access_token=token,
        username=user.username,
        role=user.role,
    )


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


def _record_fail(request: Request, username: str, message: str):
    """同步记录失败登录（用于不存在的用户）"""
    import asyncio
    asyncio.create_task(_record_login(0, username, request, False, message))


# ---------- 验证码端点 ----------

@router.post("/send-email-code")
async def send_email_code_endpoint(body: SendEmailCodeRequest):
    """发送邮箱验证码。"""
    if not EMAIL_RE.match(body.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="邮箱格式不正确")
    await send_email_code(body.email)
    return {"ok": True, "message": "验证码已发送"}


@router.post("/send-sms-code")
async def send_sms_code_endpoint(body: SendSmsCodeRequest):
    """发送短信验证码。"""
    if not PHONE_RE.match(body.phone):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="手机号格式不正确")
    await send_sms_code(body.phone)
    return {"ok": True, "message": "验证码已发送"}


# ---------- 邮箱注册/登录 ----------

@router.post("/register-email", response_model=TokenResponse)
async def register_email(body: EmailRegisterRequest, request: Request):
    """邮箱 + 验证码注册。"""
    if not EMAIL_RE.match(body.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="邮箱格式不正确")

    # 验证验证码
    if not await verify_email_code(body.email, body.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证码错误或已过期")

    async with AsyncSessionLocal() as db:
        # 检查邮箱是否已注册
        existing = await db.execute(select(User).where(User.email == body.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该邮箱已注册")

        # 用邮箱前缀生成用户名
        username = body.email.split("@")[0]
        base = username
        suffix = 1
        while True:
            r = await db.execute(select(User).where(User.username == username))
            if not r.scalar_one_or_none():
                break
            username = f"{base}{suffix}"
            suffix += 1

        user = User(
            username=username,
            password_hash=hash_password(body.password),
            email=body.email,
            email_verified=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        await _record_login(user.id, user.username, request, True, "邮箱注册并登录")

        return _make_token_response(user)


@router.post("/login-email", response_model=TokenResponse)
async def login_email(body: EmailLoginRequest, request: Request):
    """邮箱 + 验证码登录。"""
    if not EMAIL_RE.match(body.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="邮箱格式不正确")

    # 验证验证码
    if not await verify_email_code(body.email, body.code):
        _record_fail(request, body.email, "邮箱验证码错误")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证码错误或已过期")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == body.email))
        user = result.scalar_one_or_none()

        if not user:
            _record_fail(request, body.email, "邮箱未注册")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="该邮箱未注册")

        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已被禁用")

        user.last_login_at = datetime.now(timezone.utc)
        await db.commit()

        await _record_login(user.id, user.username, request, True, "邮箱验证码登录")

        return _make_token_response(user)


# ---------- 手机号注册/登录 ----------

@router.post("/register-phone", response_model=TokenResponse)
async def register_phone(body: PhoneRegisterRequest, request: Request):
    """手机号 + 验证码注册。"""
    if not PHONE_RE.match(body.phone):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="手机号格式不正确")

    if not await verify_sms_code(body.phone, body.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证码错误或已过期")

    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.phone == body.phone))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该手机号已注册")

        # 生成用户名
        username = f"user_{body.phone[-6:]}"
        base = username
        suffix = 1
        while True:
            r = await db.execute(select(User).where(User.username == username))
            if not r.scalar_one_or_none():
                break
            username = f"{base}{suffix}"
            suffix += 1

        user = User(
            username=username,
            password_hash=hash_password(body.password),
            phone=body.phone,
            phone_verified=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        await _record_login(user.id, user.username, request, True, "手机号注册并登录")

        return _make_token_response(user)


@router.post("/login-phone", response_model=TokenResponse)
async def login_phone(body: PhoneLoginRequest, request: Request):
    """手机号 + 验证码登录。"""
    if not PHONE_RE.match(body.phone):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="手机号格式不正确")

    if not await verify_sms_code(body.phone, body.code):
        _record_fail(request, body.phone, "短信验证码错误")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证码错误或已过期")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.phone == body.phone))
        user = result.scalar_one_or_none()

        if not user:
            _record_fail(request, body.phone, "手机号未注册")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="该手机号未注册")

        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已被禁用")

        user.last_login_at = datetime.now(timezone.utc)
        await db.commit()

        await _record_login(user.id, user.username, request, True, "手机号验证码登录")

        return _make_token_response(user)


# ---------- 用户名密码注册/登录 ----------

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

        return _make_token_response(user)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request):
    """用户登录。"""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == body.username))
        user = result.scalar_one_or_none()

        if not user or not verify_password(body.password, user.password_hash):
            if user:
                await _record_login(user.id, body.username, request, False, "密码错误")
            else:
                _record_fail(request, body.username, "用户不存在")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")

        if not user.is_active:
            await _record_login(user.id, user.username, request, False, "账号已禁用")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已被禁用")

        user.last_login_at = datetime.now(timezone.utc)
        await db.commit()

        await _record_login(user.id, user.username, request, True, "登录成功")

        return _make_token_response(user)


# ---------- 用户信息 ----------

@router.get("/me", response_model=UserInfo)
async def me(current_user: User = Depends(get_current_user)):
    """获取当前登录用户信息。"""
    return UserInfo(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email or "",
        phone=current_user.phone or "",
        email_verified=current_user.email_verified,
        phone_verified=current_user.phone_verified,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at.isoformat() if current_user.created_at else "",
        last_login_at=current_user.last_login_at.isoformat() if current_user.last_login_at else None,
    )


# ---------- 登录记录 ----------

@router.get("/login-records")
async def get_login_records(
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_current_user),
):
    """查看登录记录（仅管理员可查看全部，普通用户只看自己的）。"""
    async with AsyncSessionLocal() as db:
        if current_user.role == "admin":
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
        total_result = await db.execute(select(func.count(LoginRecord.id)))
        total = total_result.scalar() or 0

        success_result = await db.execute(
            select(func.count(LoginRecord.id)).where(LoginRecord.success == True)
        )
        success = success_result.scalar() or 0

        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_result = await db.execute(
            select(func.count(LoginRecord.id)).where(LoginRecord.created_at >= today)
        )
        today_count = today_result.scalar() or 0

        user_result = await db.execute(select(func.count(User.id)))
        user_count = user_result.scalar() or 0

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