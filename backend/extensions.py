# -*- coding: utf-8 -*-
"""
数据库扩展模块
- 数据库引擎和 session 管理
- 事务装饰器
"""
import os
import logging
from pathlib import Path
from functools import wraps
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


def transactional(func):
    """
    事务装饰器
    将函数包装在事务中，自动提交/回滚

    被装饰的函数第一个参数必须是 session

    用法:
        @transactional
        def create_word(session, word_data):
            word = Word(**word_data)
            session.add(word)
            return word
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        with transaction() as session:
            return func(session, *args, **kwargs)
    return wrapper


def with_session(func):
    """
    Session 装饰器（只读操作）
    将函数包装在 session 中，不自动提交

    被装饰的函数第一个参数必须是 session

    用法:
        @with_session
        def get_word(session, word_id):
            return session.query(Word).get(word_id)
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        with get_session() as session:
            return func(session, *args, **kwargs)
    return wrapper
