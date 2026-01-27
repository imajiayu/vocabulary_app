# -*- coding: utf-8 -*-
"""
配置 DAO 层

提供用户配置的数据库操作接口
"""
import logging
from datetime import datetime
from typing import Optional

from backend.extensions import get_session, transaction
from backend.models.config_models import UserConfigDB

logger = logging.getLogger(__name__)


def db_get_user_config(user_id: int = 1) -> Optional[dict]:
    """
    从数据库获取用户配置

    参数:
    - user_id: 用户ID

    返回:
    - dict: 配置字典，如果不存在返回 None
    """
    with get_session() as session:
        row = session.query(UserConfigDB).filter(UserConfigDB.user_id == user_id).first()
        if row and row.config:
            # JSONB 类型自动反序列化为 dict
            return row.config
    return None


def db_save_user_config(config_data: dict, user_id: int = 1) -> bool:
    """
    保存用户配置到数据库

    参数:
    - config_data: 配置字典
    - user_id: 用户ID

    返回:
    - bool: 是否成功
    """
    try:
        with transaction() as session:
            row = session.query(UserConfigDB).filter(UserConfigDB.user_id == user_id).first()

            if row:
                # JSONB 类型自动序列化 dict
                row.config = config_data
                row.updated_at = datetime.utcnow()
            else:
                row = UserConfigDB(user_id=user_id, config=config_data)
                session.add(row)

        return True
    except Exception as e:
        logger.error(f"Failed to save user config: {e}")
        return False
