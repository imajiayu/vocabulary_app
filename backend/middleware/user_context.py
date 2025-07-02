# -*- coding: utf-8 -*-
"""
用户上下文中间件
从 Supabase JWT 解码当前用户 UUID，实现多用户数据隔离
"""
import os
import logging
from typing import Optional
from functools import lru_cache

import jwt
from jwt import PyJWKClient
from flask import request, g

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

# JWKS URL for ECC key verification
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json" if SUPABASE_URL else ""


@lru_cache(maxsize=1)
def _get_jwks_client() -> Optional[PyJWKClient]:
    """获取 JWKS 客户端（缓存）"""
    if not JWKS_URL:
        return None
    try:
        return PyJWKClient(JWKS_URL)
    except Exception as e:
        logger.error(f"Failed to create JWKS client: {e}")
        return None


def _extract_user_id() -> Optional[str]:
    """
    从请求中提取用户 UUID。
    优先级：Authorization header > ?token query param（SSE fallback）
    支持 ECC (P-256) 和 HS256 两种签名算法
    """
    # 1. Authorization: Bearer {token}
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else None

    # 2. SSE fallback: ?token={token}
    if not token:
        token = request.args.get("token")

    if not token:
        return None

    # 尝试 ECC (JWKS) 验证
    jwks_client = _get_jwks_client()
    if jwks_client:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                audience="authenticated",
            )
            return payload.get("sub")
        except jwt.InvalidTokenError as e:
            logger.debug(f"JWKS decode failed, trying HS256: {e}")

    # 回退到 HS256 (Legacy)
    if SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
            return payload.get("sub")
        except jwt.InvalidTokenError as e:
            logger.warning(f"JWT decode failed: {e}")

    return None


def init_user_context():
    """
    在请求开始时初始化用户上下文。
    将 user_id (UUID str) 存储在 Flask g 对象中，供整个请求周期使用。
    """
    g.user_id = _extract_user_id()
