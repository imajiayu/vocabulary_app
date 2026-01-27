# -*- coding: utf-8 -*-
"""
公共工具函数
"""
from flask import session, g


def get_current_source(user_id=None):
    """Get current source filter from session, default to first available source"""
    from backend.config import UserConfig

    # 如果没有传 user_id，尝试从 Flask g 对象获取
    if user_id is None:
        user_id = getattr(g, 'user_id', 1)

    config = UserConfig(user_id)
    default_source = config.CUSTOM_SOURCES[0] if config.CUSTOM_SOURCES else "IELTS"
    return session.get("current_source", default_source)
