# -*- coding: utf-8 -*-
# 项目入口
from flask import Flask, jsonify
from flask_cors import CORS

from backend.api.speaking import speaking_api_bp
from backend.api.vocabulary import api_bp
from backend.api.settings import settings_bp
from backend.api.relations import relations_bp
from backend.api.vocabulary_assistance import vocabulary_assistance_bp

app = Flask(__name__)

app.config.from_pyfile("config.py")
app.secret_key = "your-secret-key"

app.register_blueprint(api_bp)
app.register_blueprint(speaking_api_bp)
app.register_blueprint(settings_bp, url_prefix="/api")
app.register_blueprint(relations_bp)
app.register_blueprint(vocabulary_assistance_bp)

CORS(app, resources={r"/api/*": {"origins": "*"}})


@app.route("/api/health")
def health_check():
    """健康检查端点"""
    return jsonify({"status": "healthy"})


# 初始化关系生成管理器
from backend.services.relation_generation_manager import init_manager
init_manager()

# 初始化批量释义服务，传入数据库更新回调函数
from backend.services.batch_definition_service import get_batch_definition_service
from backend.database.vocabulary_dao import db_update_word_definition_only
get_batch_definition_service(db_update_callback=db_update_word_definition_only)

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5001,
        debug=True,
    )
