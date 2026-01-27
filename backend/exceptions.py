# -*- coding: utf-8 -*-
"""
自定义异常类
统一的错误处理和响应格式
"""


class AppError(Exception):
    """应用基础异常"""

    def __init__(self, message: str, code: int = 400):
        self.message = message
        self.code = code
        super().__init__(message)
