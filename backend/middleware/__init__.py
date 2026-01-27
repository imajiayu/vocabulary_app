# -*- coding: utf-8 -*-
"""
中间件模块
"""
from .user_context import init_user_context, get_current_user_id

__all__ = ['init_user_context', 'get_current_user_id']
