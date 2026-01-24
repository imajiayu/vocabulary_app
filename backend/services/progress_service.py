# -*- coding: utf-8 -*-
"""
进度管理服务层 - 在vocabulary API和progress DAO之间的中间层
"""
import logging
from flask import session

logger = logging.getLogger(__name__)
from backend.database.progress_dao import (
    db_save_progress,
    db_get_progress,
    db_update_progress_index,
    db_get_progress_restore_data,
)


def should_use_progress_persistence():
    """判断是否应该使用进度保存功能"""
    # 可以通过session或配置来控制是否启用进度保存
    return session.get("enable_progress_persistence", True)


def save_word_ids_snapshot(mode, all_ids, shuffle_enabled, limit):
    """
    保存单词ID快照（在batch_id=0时调用）

    Args:
        mode: 学习模式
        all_ids: 单词ID列表
        shuffle_enabled: 是否启用shuffle
        limit: 单词限制数量

    Returns:
        bool: 是否保存成功
    """
    if not should_use_progress_persistence():
        return True  # 不启用时直接返回成功

    try:
        # 获取当前源设置
        current_source = session.get("current_source", "IELTS")

        # 计算initial_lapse_count和initial_lapse_word_count（仅lapse模式需要）
        initial_lapse_count = 0
        initial_lapse_word_count = 0
        if mode == "mode_lapse":
            from backend.database.vocabulary_dao import db_get_words_review_info_batch

            words = db_get_words_review_info_batch(all_ids)
            initial_lapse_count = sum(word.get("lapse", 0) for word in words)
            initial_lapse_word_count = len(words)

        # 保存进度快照
        success = db_save_progress(
            mode, current_source, shuffle_enabled, all_ids, initial_lapse_count, initial_lapse_word_count
        )
        return success
    except Exception as e:
        logger.error(f"Failed to save progress snapshot: {e}")
        return False


def update_current_progress_index(current_index):
    """
    更新当前进度位置

    Args:
        current_index: 当前位置索引

    Returns:
        bool: 是否更新成功
    """
    if not should_use_progress_persistence():
        return True  # 不启用时直接返回成功

    try:
        success = db_update_progress_index(current_index)
        return success
    except Exception as e:
        logger.error(f"Failed to update progress index: {e}")
        return False


def try_restore_from_progress():
    """
    尝试从保存的进度中恢复单词ID列表

    优化：合并 db_has_valid_progress() 和 db_get_progress() 为单次查询

    Returns:
        tuple: (success: bool, word_ids: list, mode: str)
    """
    if not should_use_progress_persistence():
        return False, [], ""

    try:
        # 单次查询获取 progress
        progress = db_get_progress()
        if not progress:
            return False, [], ""

        # 在内存中验证（原 db_has_valid_progress 的逻辑）
        word_ids = progress.get("word_ids_snapshot", [])
        if not word_ids:
            return False, [], ""

        current_index = progress.get("current_index", 0)
        if current_index < 0 or current_index >= len(word_ids):
            return False, [], ""

        mode = progress.get("mode", "")
        return True, word_ids, mode
    except Exception as e:
        logger.error(f"Failed to restore progress: {e}")
        return False, [], ""


def get_progress_info():
    """
    获取进度信息（用于前端显示）

    优化：合并 3 次查询为 1 次，在内存中构建 summary

    Returns:
        dict: 进度信息
    """
    if not should_use_progress_persistence():
        return {"enabled": False}

    try:
        # 单次查询获取 progress
        progress = db_get_progress()

        # 在内存中验证（原 db_has_valid_progress 的逻辑）
        if not progress:
            return {"enabled": True, "has_progress": False}

        word_ids = progress.get("word_ids_snapshot", [])
        if not word_ids:
            return {"enabled": True, "has_progress": False}

        current_index = progress.get("current_index", 0)
        if current_index < 0 or current_index >= len(word_ids):
            return {"enabled": True, "has_progress": False}

        # 在内存中构建 summary（原 db_get_progress_summary 的逻辑）
        total_words = len(word_ids)
        remaining_words = max(0, total_words - current_index)

        summary = {
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

        return {
            "enabled": True,
            "has_progress": True,
            "summary": summary,
            "progress": progress,
        }
    except Exception as e:
        logger.error(f"Failed to get progress info: {e}")
        return {"enabled": True, "has_progress": False, "error": str(e)}


def clear_progress():
    """
    清除当前进度

    Returns:
        bool: 是否清除成功
    """
    if not should_use_progress_persistence():
        return True

    try:
        from backend.database.progress_dao import db_clear_progress

        success = db_clear_progress()

        if success:
            logger.info("Progress cleared")

        return success
    except Exception as e:
        logger.error(f"Failed to clear progress: {e}")
        return False


def update_lapse_progress_after_word_update(word_id, updated_word):
    """
    lapse模式下，单词更新后同步进度快照

    Args:
        word_id: 更新的单词ID
        updated_word: 更新后的单词对象

    Returns:
        bool: 是否更新成功
    """
    if not should_use_progress_persistence():
        return True

    try:
        progress = db_get_progress()
        if not progress or progress.get("mode") != "mode_lapse":
            return True

        word_ids = progress.get("word_ids_snapshot", [])

        if word_id not in word_ids:
            return True  # 单词不在快照中，无需处理

        if updated_word.get("lapse", 0) == 0:
            # lapse归0，从快照中移除
            new_word_ids = [wid for wid in word_ids if wid != word_id]
            # 保持initial_lapse_count和initial_lapse_word_count不变
            success = db_save_progress(
                progress["mode"],
                progress["source"],
                progress["shuffle"],
                new_word_ids,
                progress.get("initial_lapse_count", 0),
                progress.get("initial_lapse_word_count", 0),
            )

            return success
        else:
            # lapse > 0，保持在快照中（不需要额外操作，因为我们只存ID）
            return True

    except Exception as e:
        logger.error(f"Failed to update lapse progress: {e}")
        return False


def get_progress_restore_data():
    """
    获取进度恢复数据 (业务逻辑层)

    Returns:
        tuple: (success: bool, data: dict)
    """
    if not should_use_progress_persistence():
        return False, {}

    try:
        success, data = db_get_progress_restore_data()

        if success:
            logger.info(
                f"Progress restore data retrieved: mode={data.get('mode')}, word_count={len(data.get('word_ids', []))}"
            )

        return success, data
    except Exception as e:
        logger.error(f"Failed to get progress restore data: {e}")
        return False, {}
