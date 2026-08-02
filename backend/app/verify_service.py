"""验证码发送服务：邮件(SMTP) + 阿里云短信认证。"""
from __future__ import annotations

import logging
import random
import smtplib
import string
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from sqlalchemy import select, delete

from .config import settings
from .db import AsyncSessionLocal
from .models import VerificationCode

logger = logging.getLogger(__name__)


def _generate_code() -> str:
    return ''.join(random.choices(string.digits, k=6))


async def _save_code(target: str, code: str, code_type: str) -> None:
    """保存验证码到数据库，同时清理目标旧码。"""
    async with AsyncSessionLocal() as db:
        await db.execute(
            delete(VerificationCode).where(
                VerificationCode.target == target,
                VerificationCode.code_type == code_type,
            )
        )
        expires = datetime.now(timezone.utc) + timedelta(minutes=settings.verify_code_expire_minutes)
        db.add(VerificationCode(
            target=target,
            code=code,
            code_type=code_type,
            expires_at=expires,
        ))
        await db.commit()


async def _verify_code(target: str, code: str, code_type: str) -> bool:
    """验证验证码是否正确且未过期。"""
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(VerificationCode).where(
                VerificationCode.target == target,
                VerificationCode.code == code,
                VerificationCode.code_type == code_type,
                VerificationCode.used == False,
                VerificationCode.expires_at > now,
            )
        )
        vc = result.scalar_one_or_none()
        if vc:
            vc.used = True
            await db.commit()
            return True
        return False


async def send_email_code(email: str) -> str:
    """
    发送邮箱验证码。
    返回验证码（用于测试/日志），实际通过 SMTP 发送。
    """
    code = _generate_code()

    # 保存到数据库
    await _save_code(email, code, "email")

    # 如果配置了 SMTP，发送邮件
    if settings.smtp_host and settings.smtp_user:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "电商铺货工具 - 邮箱验证码"
            msg["From"] = settings.smtp_from or settings.smtp_user
            msg["To"] = email

            html = f"""\
<html><body style="font-family:Arial,sans-serif;padding:20px;">
  <h2 style="color:#3470f6;">电商铺货工具</h2>
  <p>您的验证码是：</p>
  <div style="font-size:32px;font-weight:bold;color:#1F2937;letter-spacing:6px;padding:16px;background:#F3F4F6;border-radius:8px;text-align:center;margin:16px 0;">
    {code}
  </div>
  <p style="color:#6B7280;font-size:13px;">验证码 {settings.verify_code_expire_minutes} 分钟内有效，请勿泄露给他人。</p>
</body></html>"""
            msg.attach(MIMEText(html, "html", "utf-8"))

            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                if settings.smtp_use_tls:
                    server.starttls()
                server.login(settings.smtp_user, settings.smtp_password)
                server.sendmail(msg["From"], [email], msg.as_string())

            logger.info(f"验证码已发送至 {email}")
        except Exception as e:
            logger.error(f"邮件发送失败: {e}")
    else:
        logger.info(f"[邮箱验证码] {email} -> {code} (SMTP 未配置，仅记录)")

    return code


async def send_sms_code(phone: str) -> str:
    """
    发送短信验证码（阿里云号码认证服务，无需签名和模板）。
    返回验证码（用于测试/日志），实际通过阿里云 SDK 发送。
    """
    code = _generate_code()

    # 保存到数据库
    await _save_code(phone, code, "sms")

    # 如果配置了阿里云短信认证，发送
    if settings.aliyun_access_key_id and settings.aliyun_access_key_secret:
        try:
            from alibabacloud_dypnsapi20170525.client import Client as DypnsClient
            from alibabacloud_tea_openapi import models as open_api_models
            from alibabacloud_dypnsapi20170525 import models as dypnsapi_models
            from alibabacloud_tea_util import models as util_models

            config = open_api_models.Config(
                access_key_id=settings.aliyun_access_key_id,
                access_key_secret=settings.aliyun_access_key_secret,
            )
            config.endpoint = "dypnsapi.aliyuncs.com"
            client = DypnsClient(config)

            req = dypnsapi_models.SendSmsVerifyCodeRequest(
                phone_number=phone,
                sign_name=settings.aliyun_sms_sign_name,
                template_code=settings.aliyun_sms_template_code,
                template_param=f'{{"code":"{code}"}}',
                valid_time=settings.verify_code_expire_minutes * 60,
            )
            runtime = util_models.RuntimeOptions()
            await client.send_sms_verify_code_with_options_async(req, runtime)

            logger.info(f"短信验证码已发送至 {phone}")
        except Exception as e:
            logger.error(f"短信发送失败: {e}")
    else:
        logger.info(f"[短信验证码] {phone} -> {code} (阿里云短信未配置，仅记录)")

    return code


async def verify_email_code(email: str, code: str) -> bool:
    return await _verify_code(email, code, "email")


async def verify_sms_code(phone: str, code: str) -> bool:
    return await _verify_code(phone, code, "sms")
