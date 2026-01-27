# -*- coding: utf-8 -*-
"""
配置数据库模型

将内存/文件存储迁移到数据库，解决 Serverless 环境兼容性问题：
- UserConfigDB - 用户配置存储（原 user_config.json）
"""
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB

from backend.models.word import Base


class UserConfigDB(Base):
    """
    用户配置表 - 每用户一行存储整个配置 JSON

    使用 JSON 字段存储的理由：
    - 保持现有配置结构不变，无需映射 33+ 个属性
    - 深度合并逻辑可以复用
    - 配置变更时只需更新一个字段
    - 向后兼容性最好
    """
    __tablename__ = "user_config"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, default=1)
    config = Column(JSONB, nullable=True)  # JSONB 类型，与 migration 一致
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 多用户：每个用户一行配置
    __table_args__ = (
        UniqueConstraint("user_id", name="unique_config_per_user"),
    )
