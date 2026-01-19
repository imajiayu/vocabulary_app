# -*- coding: utf-8 -*-
"""
Vercel Serverless Function 入口
将 Flask 应用暴露给 Vercel
"""
import sys
import os

# 获取项目根目录
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 添加项目根目录到 Python 路径
sys.path.insert(0, ROOT_DIR)

from flask import Flask, jsonify
from flask_cors import CORS

from backend.api.speaking import speaking_api_bp
from backend.api.vocabulary import api_bp
from backend.api.settings import settings_bp
from backend.api.relations import relations_bp
from backend.api.vocabulary_assistance import vocabulary_assistance_bp

app = Flask(__name__)

# 使用绝对路径加载配置
app.config.from_pyfile(os.path.join(ROOT_DIR, "backend/config.py"))
app.secret_key = os.environ.get("SECRET_KEY", "your-secret-key")

app.register_blueprint(api_bp)
app.register_blueprint(speaking_api_bp)
app.register_blueprint(settings_bp, url_prefix="/api")
app.register_blueprint(relations_bp)
app.register_blueprint(vocabulary_assistance_bp)

CORS(app, resources={r"/api/*": {"origins": "*"}})


@app.route("/api/health")
def health_check():
    """健康检查端点"""
    return jsonify({"status": "healthy", "env": "vercel"})


# 注意：在 Serverless 环境中，后台线程服务不可用
# 批量释义获取和关系生成需要改为同步处理或使用外部队列

# Vercel 自动检测 Flask 的 app 对象作为 WSGI 入口
