# -*- coding: utf-8 -*-
"""统一 API 响应格式"""
from flask import jsonify


def api_success(data=None):
    """成功响应: {"success": true, "data": ..., "error": null}"""
    return jsonify({"success": True, "data": data, "error": None})


def api_error(msg: str, status: int = 400):
    """错误响应: {"success": false, "data": null, "error": "..."}"""
    return jsonify({"success": False, "data": None, "error": msg}), status
