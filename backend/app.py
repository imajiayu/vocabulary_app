# -*- coding: utf-8 -*-
"""
Flask 应用入口
- 仅保留 relations 图查询 API
- 其他功能已迁移到前端直连 Supabase
"""
import logging
import os
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from sqlalchemy.exc import SQLAlchemyError

from backend.exceptions import AppError
from backend.middleware.user_context import init_user_context

# 无需认证的路径前缀
_PUBLIC_PATHS = {"/api/health"}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def create_app():
    """应用工厂函数"""
    app = Flask(__name__)

    # 注册蓝图
    from backend.api.relations import relations_bp
    from backend.api.generation import generation_bp
    app.register_blueprint(relations_bp)
    app.register_blueprint(generation_bp)

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    @app.before_request
    def before_request():
        # OPTIONS preflight 无需认证
        if request.method == "OPTIONS":
            return
        # 公开端点无需认证
        if request.path in _PUBLIC_PATHS:
            return
        # 解析 JWT → g.user_id
        init_user_context()
        if not g.user_id:
            return jsonify({"success": False, "error": "Unauthorized"}), 401

    register_error_handlers(app)

    @app.route("/api/health")
    def health_check():
        return jsonify({"status": "healthy"})

    return app


def register_error_handlers(app):
    """注册全局错误处理器"""

    @app.errorhandler(AppError)
    def handle_app_error(error):
        logger.warning(f"AppError: {error.message} (code={error.code})")
        return jsonify({"success": False, "error": error.message}), error.code

    @app.errorhandler(SQLAlchemyError)
    def handle_db_error(error):
        logger.error(f"Database error: {error}", exc_info=True)
        return jsonify({"success": False, "error": "数据库操作失败"}), 500

    @app.errorhandler(404)
    def handle_not_found(error):
        return jsonify({"success": False, "error": "资源不存在"}), 404

    @app.errorhandler(500)
    def handle_internal_error(error):
        logger.error(f"Internal error: {error}", exc_info=True)
        return jsonify({"success": False, "error": "服务器内部错误"}), 500

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        logger.exception(f"Unexpected error: {error}")
        return jsonify({"success": False, "error": "服务器内部错误"}), 500


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
