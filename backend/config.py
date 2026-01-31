# -*- coding: utf-8 -*-
"""
配置模块 - 从数据库加载用户配置
"""
import json
import logging
import threading

logger = logging.getLogger(__name__)

# 默认配置（用于初始化和回退）
DEFAULT_CONFIG = {
    "learning": {
        "dailyReviewLimit": 300,
        "dailySpellLimit": 200,
        "maxPrepDays": 30,
        "lapseQueueSize": 20,
        "defaultShuffle": True,
        "lowEfExtraCount": 0,
    },
    "sources": {
        "customSources": ["IELTS", "GRE"],
    },
}


def _load_config_from_db(user_id: int = 1) -> dict:
    """从数据库加载配置，失败时返回空字典"""
    try:
        from backend.database.config_dao import db_get_user_config
        config = db_get_user_config(user_id)
        return config if config else {}
    except Exception as e:
        logger.warning(f"Failed to load config from database: {e}")
        return {}


def _save_config_to_db(config: dict, user_id: int = 1) -> bool:
    """保存配置到数据库"""
    try:
        from backend.database.config_dao import db_save_user_config
        return db_save_user_config(config, user_id)
    except Exception as e:
        logger.error(f"Failed to save config to database: {e}")
        return False


def _deep_merge(base: dict, override: dict) -> dict:
    """深度合并两个字典，override覆盖base"""
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


class UserConfig:
    """
    用户配置类 - 多用户支持
    配置持久化在数据库 user_config 表中，按 user_id 隔离
    """
    _instance = None
    _lock = threading.Lock()
    _configs: dict = {}  # user_id -> config dict
    _current_user_id: int = 1  # 当前用户ID

    def __new__(cls, user_id: int = None):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, user_id: int = None):
        """初始化或切换用户配置"""
        if user_id is not None:
            self._current_user_id = user_id
        # 确保当前用户配置已加载
        if self._current_user_id not in self._configs:
            self._load(self._current_user_id)

    @property
    def _config(self) -> dict:
        """获取当前用户的配置"""
        if self._current_user_id not in self._configs:
            self._load(self._current_user_id)
        return self._configs[self._current_user_id]

    def _load(self, user_id: int = None):
        """从数据库加载配置"""
        uid = user_id if user_id is not None else self._current_user_id
        db_config = _load_config_from_db(uid)

        if db_config:
            # 数据库有配置，与默认配置合并确保所有字段存在
            self._configs[uid] = _deep_merge(DEFAULT_CONFIG, db_config)
        else:
            # 数据库无配置，使用默认配置
            self._configs[uid] = DEFAULT_CONFIG.copy()

    def reload(self, user_id: int = None):
        """重新从数据库加载配置"""
        uid = user_id if user_id is not None else self._current_user_id
        self._load(uid)

    def save(self, user_id: int = None):
        """保存配置到数据库"""
        uid = user_id if user_id is not None else self._current_user_id
        with self._lock:
            config = self._configs.get(uid, DEFAULT_CONFIG.copy())
            if not _save_config_to_db(config, uid):
                raise IOError("Failed to save config to database")

    # ========== 学习设置 ==========
    @property
    def DAILY_REVIEW_LIMIT(self) -> int:
        return self._config["learning"]["dailyReviewLimit"]

    @property
    def DAILY_SPELL_LIMIT(self) -> int:
        return self._config["learning"]["dailySpellLimit"]

    @property
    def MAX_PREP_DAYS(self) -> int:
        return self._config["learning"]["maxPrepDays"]

    @property
    def LAPSE_QUEUE_SIZE(self) -> int:
        return self._config["learning"]["lapseQueueSize"]

    @property
    def DEFAULT_SHUFFLE(self) -> bool:
        return self._config["learning"]["defaultShuffle"]

    @property
    def LOW_EF_EXTRA_COUNT(self) -> int:
        return self._config["learning"]["lowEfExtraCount"]

    # ========== Source 设置 ==========
    @property
    def CUSTOM_SOURCES(self) -> list:
        return self._config["sources"]["customSources"]

    # ========== API方法 ==========
    @classmethod
    def to_dict(cls, user_id: int = 1) -> dict:
        """转换为字典用于API传输"""
        instance = cls(user_id)
        return instance._config.copy()

    @classmethod
    def update_from_dict(cls, data: dict, user_id: int = 1):
        """从字典更新配置"""
        instance = cls(user_id)
        with cls._lock:
            # 深度合并更新
            instance._configs[user_id] = _deep_merge(instance._config, data)

    @classmethod
    def update_custom_sources(cls, sources: list, user_id: int = 1):
        """更新自定义源（带验证）"""
        if not isinstance(sources, list) or not (1 <= len(sources) <= 3):
            raise ValueError("customSources必须是1-3个元素的列表")
        if len(sources) != len(set(sources)):
            raise ValueError("customSources不能有重复值")
        instance = cls(user_id)
        with cls._lock:
            instance._configs[user_id]["sources"]["customSources"] = sources


# --- 工具函数（向后兼容） ---
def get_shuffle_setting(user_id: int = None) -> bool:
    """获取shuffle设置"""
    from flask import g
    if user_id is None:
        user_id = getattr(g, 'user_id', 1)
    return UserConfig(user_id).DEFAULT_SHUFFLE


# --- 常量定义 ---
LOW_EF_THRESHOLD = 2.5  # 低 EF 阈值


# === 负荷均衡配置 ===
class ReviewLoadLimits:
    """每日复习负荷限制配置"""

    @staticmethod
    def get_daily_review_limit(user_id: int = None) -> int:
        from flask import g
        if user_id is None:
            user_id = getattr(g, 'user_id', 1)
        return UserConfig(user_id).DAILY_REVIEW_LIMIT

    @staticmethod
    def get_daily_spell_limit(user_id: int = None) -> int:
        from flask import g
        if user_id is None:
            user_id = getattr(g, 'user_id', 1)
        return UserConfig(user_id).DAILY_SPELL_LIMIT

    @staticmethod
    def get_max_prep_days(user_id: int = None) -> int:
        from flask import g
        if user_id is None:
            user_id = getattr(g, 'user_id', 1)
        return UserConfig(user_id).MAX_PREP_DAYS
