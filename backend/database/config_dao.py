# -*- coding: utf-8 -*-
"""
配置 DAO 层

提供用户配置的数据库操作接口
"""
import json
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
        config = session.query(UserConfigDB).filter(UserConfigDB.user_id == user_id).first()
        if config:
            try:
                return json.loads(config.config_json)
            except json.JSONDecodeError:
                logger.error("Failed to parse user config JSON")
                return None
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
            config = session.query(UserConfigDB).filter(UserConfigDB.user_id == user_id).first()
            config_json = json.dumps(config_data, ensure_ascii=False)

            if config:
                config.config_json = config_json
                config.updated_at = datetime.utcnow()
            else:
                config = UserConfigDB(user_id=user_id, config_json=config_json)
                session.add(config)

        return True
    except Exception as e:
        logger.error(f"Failed to save user config: {e}")
        return False


def db_ensure_user_config_exists(default_config: dict, user_id: int = 1) -> None:
    """
    确保用户配置表中有数据，如果没有则插入默认配置

    参数:
    - default_config: 默认配置字典
    - user_id: 用户ID
    """
    with get_session() as session:
        config = session.query(UserConfigDB).filter(UserConfigDB.user_id == user_id).first()
        if config is None:
            try:
                with transaction() as tx_session:
                    new_config = UserConfigDB(
                        user_id=user_id,
                        config_json=json.dumps(default_config, ensure_ascii=False)
                    )
                    tx_session.add(new_config)
                logger.info(f"Initialized default user config in database for user_id={user_id}")
            except Exception as e:
                logger.error(f"Failed to initialize user config: {e}")
