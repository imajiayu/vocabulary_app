# -*- coding: utf-8 -*-
# 项目入口
from flask import Flask
from flask_cors import CORS

from web_app.api.speaking import speaking_api_bp
from web_app.api.vocabulary import api_bp
from web_app.extensions import socketio

# 导入websocket服务以注册事件处理器
from web_app.services import websocket_service

app = Flask(__name__)

app.config.from_pyfile("config.py")
app.secret_key = "your-secret-key"

app.register_blueprint(api_bp)
app.register_blueprint(speaking_api_bp)

CORS(app, resources={r"/api/*": {"origins": "*"}})

# 初始化SocketIO
socketio.init_app(app, cors_allowed_origins="*")

if __name__ == "__main__":
    # 使用socketio.run而不是app.run来支持WebSocket
    socketio.run(
        app,
        host="0.0.0.0",
        port=5001,
        debug=True,  # 重新启用debug模式查看print输出
        allow_unsafe_werkzeug=True,
        use_reloader=False,  # 保持禁用重载器以避免WebSocket问题
        log_output=True,  # 确保日志输出
    )
