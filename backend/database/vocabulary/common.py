# -*- coding: utf-8 -*-
"""
公共工具函数
"""
from flask import session


def get_current_source():
    """Get current source filter from session, default to first available source"""
    from backend.config import UserConfig

    config = UserConfig()
    default_source = config.CUSTOM_SOURCES[0] if config.CUSTOM_SOURCES else "IELTS"
    return session.get("current_source", default_source)
