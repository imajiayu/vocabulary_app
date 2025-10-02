# 数据库引擎和 session
from sqlalchemy import create_engine
from contextlib import contextmanager
from web_app.config import DB_PATH
from sqlalchemy.orm import sessionmaker


engine = create_engine(f"sqlite:///{DB_PATH}", echo=False, future=True)
SessionLocal = sessionmaker(bind=engine)


@contextmanager
def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


from flask_socketio import SocketIO

socketio = SocketIO(
    cors_allowed_origins="*",
    async_mode='threading',
    logger=False,        # 禁用详细日志
    engineio_logger=False,  # 禁用引擎日志
    ping_timeout=60,
    ping_interval=25,
    transports=['websocket', 'polling'],  # 允许 polling 作为后备
    upgrade=True,
    always_connect=False,
    max_http_buffer_size=1000000  # 1MB buffer
)
