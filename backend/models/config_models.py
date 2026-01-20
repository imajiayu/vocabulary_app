# -*- coding: utf-8 -*-
"""
配置和进度数据库模型

将内存/文件存储迁移到数据库，解决 Serverless 环境兼容性问题：
1. UserConfigDB - 用户配置存储（原 user_config.json）
2. TaskProgressDB - 关系生成进度存储（原内存 _progress_store）
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, CheckConstraint

from backend.models.word import Base


class UserConfigDB(Base):
    """
    用户配置表 - 单行存储整个配置 JSON

    使用 JSON 字段存储的理由：
    - 保持现有配置结构不变，无需映射 33+ 个属性
    - 深度合并逻辑可以复用
    - 配置变更时只需更新一个字段
    - 向后兼容性最好
    """
    __tablename__ = "user_config"

    id = Column(Integer, primary_key=True, default=1)
    config_json = Column(Text, nullable=False)  # 存储完整配置 JSON
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 确保只有一行记录
    __table_args__ = (
        CheckConstraint("id = 1", name="user_config_single_row"),
    )


class TaskProgressDB(Base):
    """
    任务进度表 - 存储关系生成进度

    替代内存中的 _progress_store，使进度在 Serverless 环境下持久化
    """
    __tablename__ = "task_progress"

    id = Column(Integer, primary_key=True, autoincrement=True)
    relation_type = Column(String(20), unique=True, nullable=False)  # synonym, antonym, root, confused, topic
    status = Column(String(20), default="pending")  # pending, running, completed, error, stopped
    current_progress = Column(Integer, default=0)  # 当前处理数
    total_words = Column(Integer, default=0)  # 总单词数
    percent = Column(Float, default=0.0)  # 完成百分比
    message = Column(Text, default="")  # 状态消息
    error_message = Column(Text, default="")  # 错误信息
    total_count = Column(Integer, default=0)  # 完成时的总关系数
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
