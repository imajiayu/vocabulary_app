# 数据库引擎和 session
import os
from sqlalchemy import create_engine
from contextlib import contextmanager
from sqlalchemy.orm import sessionmaker

# 数据库配置：优先使用环境变量 DATABASE_URL（Supabase），否则使用本地 SQLite
DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    # Supabase PostgreSQL
    engine = create_engine(DATABASE_URL, echo=False, future=True, pool_pre_ping=True)
    DB_TYPE = "postgresql"
else:
    # 本地 SQLite
    from web_app.config import DB_PATH
    engine = create_engine(f"sqlite:///{DB_PATH}", echo=False, future=True)
    DB_TYPE = "sqlite"

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
    async_mode="threading",
    logger=False,  # 禁用详细日志
    engineio_logger=False,  # 禁用引擎日志
    ping_timeout=60,
    ping_interval=25,
    transports=["websocket", "polling"],  # 允许 polling 作为后备
    upgrade=True,
    always_connect=False,
    max_http_buffer_size=1000000,  # 1MB buffer
)
