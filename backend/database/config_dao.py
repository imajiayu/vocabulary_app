# -*- coding: utf-8 -*-
"""
配置和进度 DAO 层

提供用户配置和任务进度的数据库操作接口
"""
import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from backend.extensions import get_session, transaction
from backend.models.config_models import UserConfigDB, TaskProgressDB

logger = logging.getLogger(__name__)


# ==================== 用户配置 DAO ====================

def db_get_user_config() -> Optional[dict]:
    """
    从数据库获取用户配置

    返回:
    - dict: 配置字典，如果不存在返回 None
    """
    with get_session() as session:
        config = session.query(UserConfigDB).filter(UserConfigDB.id == 1).first()
        if config:
            try:
                return json.loads(config.config_json)
            except json.JSONDecodeError:
                logger.error("Failed to parse user config JSON")
                return None
    return None


def db_save_user_config(config_data: dict) -> bool:
    """
    保存用户配置到数据库

    参数:
    - config_data: 配置字典

    返回:
    - bool: 是否成功
    """
    try:
        with transaction() as session:
            config = session.query(UserConfigDB).filter(UserConfigDB.id == 1).first()
            config_json = json.dumps(config_data, ensure_ascii=False)

            if config:
                config.config_json = config_json
                config.updated_at = datetime.utcnow()
            else:
                config = UserConfigDB(id=1, config_json=config_json)
                session.add(config)

        return True
    except Exception as e:
        logger.error(f"Failed to save user config: {e}")
        return False


def db_ensure_user_config_exists(default_config: dict) -> None:
    """
    确保用户配置表中有数据，如果没有则插入默认配置

    参数:
    - default_config: 默认配置字典
    """
    with get_session() as session:
        config = session.query(UserConfigDB).filter(UserConfigDB.id == 1).first()
        if config is None:
            try:
                with transaction() as tx_session:
                    new_config = UserConfigDB(
                        id=1,
                        config_json=json.dumps(default_config, ensure_ascii=False)
                    )
                    tx_session.add(new_config)
                logger.info("Initialized default user config in database")
            except Exception as e:
                logger.error(f"Failed to initialize user config: {e}")


# ==================== 任务进度 DAO ====================

def db_get_task_progress(relation_type: str) -> Optional[Dict[str, Any]]:
    """
    获取指定关系类型的生成进度

    参数:
    - relation_type: 关系类型（synonym, antonym, root, confused, topic）

    返回:
    - dict: 进度信息，如果不存在返回 None
    """
    with get_session() as session:
        progress = session.query(TaskProgressDB).filter(
            TaskProgressDB.relation_type == relation_type
        ).first()

        if progress:
            return {
                "relation_type": progress.relation_type,
                "status": progress.status,
                "current": progress.current_progress,
                "total": progress.total_words,
                "percent": progress.percent,
                "message": progress.message,
                "error": progress.error_message,
                "total_count": progress.total_count
            }
    return None


def db_get_all_task_progress() -> Dict[str, Dict[str, Any]]:
    """
    获取所有任务的进度

    返回:
    - dict: {relation_type: progress_dict}
    """
    result = {}
    with get_session() as session:
        all_progress = session.query(TaskProgressDB).all()
        for progress in all_progress:
            result[progress.relation_type] = {
                "relation_type": progress.relation_type,
                "status": progress.status,
                "current": progress.current_progress,
                "total": progress.total_words,
                "percent": progress.percent,
                "message": progress.message,
                "error": progress.error_message,
                "total_count": progress.total_count
            }
    return result


def db_save_task_progress(
    relation_type: str,
    status: str,
    current: int = 0,
    total: int = 0,
    percent: float = 0.0,
    message: str = "",
    error: str = "",
    total_count: int = 0
) -> bool:
    """
    保存或更新任务进度

    参数:
    - relation_type: 关系类型
    - status: 状态（pending, running, completed, error, stopped）
    - current: 当前处理数
    - total: 总数
    - percent: 完成百分比
    - message: 状态消息
    - error: 错误信息
    - total_count: 完成时的总关系数

    返回:
    - bool: 是否成功
    """
    try:
        with transaction() as session:
            progress = session.query(TaskProgressDB).filter(
                TaskProgressDB.relation_type == relation_type
            ).first()

            if progress:
                progress.status = status
                progress.current_progress = current
                progress.total_words = total
                progress.percent = percent
                progress.message = message
                progress.error_message = error
                progress.total_count = total_count
                progress.updated_at = datetime.utcnow()
            else:
                progress = TaskProgressDB(
                    relation_type=relation_type,
                    status=status,
                    current_progress=current,
                    total_words=total,
                    percent=percent,
                    message=message,
                    error_message=error,
                    total_count=total_count
                )
                session.add(progress)

        return True
    except Exception as e:
        logger.error(f"Failed to save task progress for {relation_type}: {e}")
        return False


def db_clear_task_progress(relation_type: str) -> bool:
    """
    清除指定类型的进度状态

    参数:
    - relation_type: 关系类型

    返回:
    - bool: 是否成功
    """
    try:
        with transaction() as session:
            session.query(TaskProgressDB).filter(
                TaskProgressDB.relation_type == relation_type
            ).delete()
        return True
    except Exception as e:
        logger.error(f"Failed to clear task progress for {relation_type}: {e}")
        return False
