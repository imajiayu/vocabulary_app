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


class NotFoundError(AppError):
    """资源未找到"""

    def __init__(self, resource: str, identifier=None):
        msg = f"{resource}不存在"
        if identifier:
            msg = f"{resource} '{identifier}' 不存在"
        super().__init__(msg, 404)


class ValidationError(AppError):
    """输入验证错误"""

    def __init__(self, field: str, reason: str):
        super().__init__(f"无效的{field}: {reason}", 400)


class DatabaseError(AppError):
    """数据库操作错误"""

    def __init__(self, operation: str, detail: str = None):
        msg = f"数据库错误: {operation}"
        if detail:
            msg += f" ({detail})"
        super().__init__(msg, 500)


class ConfigError(AppError):
    """配置错误"""

    def __init__(self, message: str):
        super().__init__(f"配置错误: {message}", 400)
