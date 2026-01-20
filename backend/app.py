# -*- coding: utf-8 -*-
"""
Flask 应用入口
- 蓝图注册
- 全局错误处理
- 日志配置
"""
import logging
import os
from flask import Flask, jsonify
from flask_cors import CORS
from sqlalchemy.exc import SQLAlchemyError

from backend.exceptions import AppError

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def create_app():
    """应用工厂函数"""
    app = Flask(__name__)

    # 配置
    app.config.from_pyfile("config.py")
    app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")

    # 注册蓝图
    from backend.api.vocabulary import api_bp
    from backend.api.speaking import speaking_api_bp
    from backend.api.settings import settings_bp
    from backend.api.relations import relations_bp
    from backend.api.vocabulary_assistance import vocabulary_assistance_bp

    app.register_blueprint(api_bp)
    app.register_blueprint(speaking_api_bp)
    app.register_blueprint(settings_bp, url_prefix="/api")
    app.register_blueprint(relations_bp)
    app.register_blueprint(vocabulary_assistance_bp)

    # CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # 注册全局错误处理器
    register_error_handlers(app)

    # 健康检查
    @app.route("/api/health")
    def health_check():
        return jsonify({"status": "healthy"})

    return app


def register_error_handlers(app):
    """注册全局错误处理器"""

    @app.errorhandler(AppError)
    def handle_app_error(error):
        """处理应用自定义异常"""
        logger.warning(f"AppError: {error.message} (code={error.code})")
        return jsonify({"success": False, "error": error.message}), error.code

    @app.errorhandler(SQLAlchemyError)
    def handle_db_error(error):
        """处理数据库异常"""
        logger.error(f"Database error: {error}", exc_info=True)
        return jsonify({"success": False, "error": "数据库操作失败"}), 500

    @app.errorhandler(404)
    def handle_not_found(error):
        """处理404"""
        return jsonify({"success": False, "error": "资源不存在"}), 404

    @app.errorhandler(500)
    def handle_internal_error(error):
        """处理500"""
        logger.error(f"Internal error: {error}", exc_info=True)
        return jsonify({"success": False, "error": "服务器内部错误"}), 500

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        """处理未预期的异常"""
        logger.exception(f"Unexpected error: {error}")
        return jsonify({"success": False, "error": "服务器内部错误"}), 500


# 创建应用实例
app = create_app()

# 关系生成服务已移除，改为本地 CSV 导入方式
# 批量释义服务已移除，改为前端同步调用 POST /words/<id>/fetch-definition

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5001,
        debug=True,
    )
