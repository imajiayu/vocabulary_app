# -*- coding: utf-8 -*-
"""
用户上下文中间件
从请求头获取当前用户 ID，实现多用户数据隔离
"""
from flask import request, g

VALID_USER_IDS = {1, 2}
DEFAULT_USER_ID = 1


def get_current_user_id() -> int:
    """
    从请求头获取当前用户 ID

    返回:
    - int: 用户ID (1 或 2)，无效值返回默认值 1
    """
    try:
        user_id = int(request.headers.get('X-User-ID', DEFAULT_USER_ID))
        if user_id not in VALID_USER_IDS:
            user_id = DEFAULT_USER_ID
    except (ValueError, TypeError):
        user_id = DEFAULT_USER_ID
    return user_id


def init_user_context():
    """
    在请求开始时初始化用户上下文
    将 user_id 存储在 Flask g 对象中，供整个请求周期使用
    """
    g.user_id = get_current_user_id()
