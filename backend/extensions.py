# -*- coding: utf-8 -*-
"""
数据库扩展模块
- 数据库引擎和 session 管理
- 事务上下文管理器
"""
import os
import logging
from pathlib import Path
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError

# 加载项目根目录的 .env 文件
from dotenv import load_dotenv
project_root = Path(__file__).parent.parent
load_dotenv(project_root / ".env")

logger = logging.getLogger(__name__)

# 数据库配置：必须设置环境变量 DATABASE_URL（Supabase PostgreSQL）
DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is required. "
        "Please set it to your Supabase PostgreSQL connection string."
    )

engine = create_engine(DATABASE_URL, echo=False, future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)


@contextmanager
def get_session():
    """
    获取数据库 session 的上下文管理器
    自动关闭 session，但不自动提交
    """
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def transaction():
    """
    事务上下文管理器
    自动提交成功的事务，自动回滚失败的事务

    用法:
        with transaction() as session:
            session.add(obj)
            # 自动提交
    """
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except SQLAlchemyError as e:
        session.rollback()
        logger.error(f"事务回滚: {e}")
        raise
    except Exception as e:
        session.rollback()
        logger.error(f"事务回滚（非数据库异常）: {e}")
        raise
    finally:
        session.close()
