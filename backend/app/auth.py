"""JWT 认证工具：生成/验证 token、密码哈希、获取当前用户、账户锁定。"""
from __future__ import annotations

import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy import select

from .config import settings
from .db import AsyncSessionLocal
from .models import User

security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None


async def check_account_locked(user: User) -> None:
    """检查账户是否被锁定，若锁定时间已过则自动解锁。"""
    if user.locked_until:
        if datetime.now(timezone.utc) < user.locked_until:
            # 不泄露具体锁定状态，统一返回认证失败
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误",
            )
        else:
            # 锁定时间已过，自动解锁
            async with AsyncSessionLocal() as db:
                user.locked_until = None
                user.login_attempts = 0
                await db.commit()


async def record_failed_attempt(user: User) -> None:
    """记录登录失败，达到阈值时锁定账户。"""
    async with AsyncSessionLocal() as db:
        user.login_attempts += 1
        if user.login_attempts >= settings.max_login_attempts:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=settings.login_lockout_minutes)
        await db.commit()


async def reset_login_attempts(user: User) -> None:
    """登录成功后重置失败计数。"""
    async with AsyncSessionLocal() as db:
        user.login_attempts = 0
        user.locked_until = None
        await db.commit()


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> User:
    """从请求中提取并验证当前用户。未登录返回 401。"""
    if not credentials:
        token = request.cookies.get("pds_token")
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="请先登录")
        payload = decode_token(token)
    else:
        payload = decode_token(credentials.credentials)

    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已过期，请重新登录")

    username: str = payload.get("sub")
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的登录凭证")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在或已被禁用")

        # 检查账户锁定
        await check_account_locked(user)

        return user


async def get_optional_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> User | None:
    """可选获取当前用户，未登录返回 None。"""
    try:
        return await get_current_user(request, credentials)
    except HTTPException:
        return None