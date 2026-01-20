# -*- coding: utf-8 -*-
import json
import logging
from sqlalchemy.exc import IntegrityError
from backend.extensions import get_session
from backend.models.word import Progress

logger = logging.getLogger(__name__)


def db_save_progress(mode, source, shuffle, word_ids, initial_lapse_count=0, initial_lapse_word_count=0):
    """
    保存学习进度（覆盖式更新）

    Args:
        mode: 学习模式 ('mode_review', 'mode_lapse', 'mode_spelling')
        source: 单词来源 ('IELTS', 'GRE')
        shuffle: 是否打乱顺序
        word_ids: 单词ID列表
        initial_lapse_count: lapse模式的初始总lapse数（仅lapse模式需要）
        initial_lapse_word_count: lapse模式的初始单词数量（仅lapse模式需要）

    Returns:
        bool: 是否保存成功
    """
    try:
        with get_session() as db:
            # 查找现有记录
            existing_progress = db.query(Progress).filter(Progress.id == 1).first()

            if existing_progress:
                # 更新现有记录
                existing_progress.mode = mode
                existing_progress.source = source
                existing_progress.shuffle = shuffle
                existing_progress.word_ids_snapshot = json.dumps(word_ids)
                existing_progress.current_index = 0
                existing_progress.initial_lapse_count = initial_lapse_count
                existing_progress.initial_lapse_word_count = initial_lapse_word_count
            else:
                # 创建新记录
                new_progress = Progress(
                    id=1,
                    mode=mode,
                    source=source,
                    shuffle=shuffle,
                    word_ids_snapshot=json.dumps(word_ids),
                    current_index=0,
                    initial_lapse_count=initial_lapse_count,
                    initial_lapse_word_count=initial_lapse_word_count,
                )
                db.add(new_progress)

            db.commit()
            return True

    except Exception as e:
        logger.error(f"Error saving progress: {e}")
        if db:
            db.rollback()
        return False


def db_get_progress():
    """
    获取当前学习进度

    Returns:
        dict or None: 进度数据，如果没有进度则返回None
    """
    try:
        with get_session() as db:
            progress = db.query(Progress).filter(Progress.id == 1).first()

            if not progress:
                return None

            return progress.to_dict()

    except Exception as e:
        logger.error(f"Error getting progress: {e}")
        return None


def db_update_progress_index(current_index):
    """
    更新学习进度位置

    Args:
        current_index: 当前进度位置

    Returns:
        bool: 是否更新成功
    """
    try:
        with get_session() as db:
            progress = db.query(Progress).filter(Progress.id == 1).first()

            if progress:
                progress.current_index = current_index
                db.commit()
                return True
            else:
                logger.warning("No progress record found to update")
                return False

    except Exception as e:
        logger.error(f"Error updating progress index: {e}")
        if db:
            db.rollback()
        return False


def db_clear_progress():
    """
    清除学习进度（重置为初始状态）

    Returns:
        bool: 是否清除成功
    """
    try:
        with get_session() as db:
            progress = db.query(Progress).filter(Progress.id == 1).first()

            if progress:
                progress.mode = "mode_review"
                progress.source = "IELTS"
                progress.shuffle = False
                progress.word_ids_snapshot = "[]"
                progress.current_index = 0
                progress.initial_lapse_count = 0
                progress.initial_lapse_word_count = 0
                db.commit()
                return True
            else:
                # 如果没有记录，创建一个初始记录
                initial_progress = Progress(
                    id=1,
                    mode="mode_review",
                    source="IELTS",
                    shuffle=False,
                    word_ids_snapshot="[]",
                    current_index=0,
                    initial_lapse_count=0,
                    initial_lapse_word_count=0,
                )
                db.add(initial_progress)
                db.commit()
                return True

    except Exception as e:
        logger.error(f"Error clearing progress: {e}")
        if db:
            db.rollback()
        return False


def db_has_valid_progress():
    """
    检查是否有有效的学习进度

    Returns:
        bool: 是否有有效进度
    """
    progress = db_get_progress()

    if not progress:
        return False

    # 检查是否有单词队列
    word_ids = progress.get("word_ids_snapshot", [])
    if not word_ids or len(word_ids) == 0:
        return False

    # 检查进度是否合理
    current_index = progress.get("current_index", 0)
    if current_index < 0 or current_index >= len(word_ids):
        return False

    return True


def db_get_progress_summary():
    """
    获取学习进度摘要信息

    Returns:
        dict: 包含进度摘要的字典
    """
    progress = db_get_progress()

    if not progress:
        return {
            "has_progress": False,
            "total_words": 0,
            "current_index": 0,
            "remaining_words": 0,
        }

    word_ids = progress.get("word_ids_snapshot", [])
    current_index = progress.get("current_index", 0)
    total_words = len(word_ids)
    remaining_words = max(0, total_words - current_index)

    return {
        "has_progress": True,
        "mode": progress.get("mode"),
        "source": progress.get("source"),
        "shuffle": progress.get("shuffle"),
        "total_words": total_words,
        "current_index": current_index,
        "remaining_words": remaining_words,
        "initial_lapse_count": progress.get("initial_lapse_count", 0),
        "initial_lapse_word_count": progress.get("initial_lapse_word_count", 0),
    }


def db_get_active_lapse_words(word_ids):
    """
    获取仍需复习的lapse单词 (lapse > 0)

    Args:
        word_ids: 单词ID列表

    Returns:
        list: 仍需复习的单词对象列表
    """
    try:
        with get_session() as db:
            from backend.models.word import Word

            active_words = (
                db.query(Word).filter(Word.id.in_(word_ids), Word.lapse > 0).all()
            )
            return [word.to_dict() for word in active_words]
    except Exception as e:
        logger.error(f"Error getting active lapse words: {e}")
        return []


def db_get_progress_restore_data():
    """
    获取完整的进度恢复数据

    Returns:
        tuple: (success: bool, data: dict)
    """
    try:
        progress = db_get_progress()
        if not progress:
            return False, {}

        word_ids = progress.get("word_ids_snapshot", [])
        mode = progress.get("mode")

        # 对于lapse模式，需要过滤已完成的单词
        if mode == "mode_lapse" and word_ids:
            active_words = db_get_active_lapse_words(word_ids)
            active_word_ids = [w["id"] for w in active_words]

            # 如果有单词被过滤掉，更新快照（保持initial_lapse_count和initial_lapse_word_count不变）
            if len(active_word_ids) != len(word_ids):
                success = db_save_progress(
                    progress["mode"],
                    progress["source"],
                    progress["shuffle"],
                    active_word_ids,
                    progress.get("initial_lapse_count", 0),
                    progress.get("initial_lapse_word_count", 0),
                )
                if not success:
                    return False, {}
                # 更新word_ids为过滤后的结果
                word_ids = active_word_ids

        return True, {
            "mode": progress.get("mode"),
            "source": progress.get("source"),
            "shuffle": progress.get("shuffle"),
            "current_index": progress.get("current_index", 0),
            "word_ids": word_ids,
            "initial_lapse_count": progress.get("initial_lapse_count", 0),
            "initial_lapse_word_count": progress.get("initial_lapse_word_count", 0),
        }

    except Exception as e:
        logger.error(f"Error getting progress restore data: {e}")
        return False, {}
