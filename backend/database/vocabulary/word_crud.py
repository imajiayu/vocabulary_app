# -*- coding: utf-8 -*-
"""
单词 CRUD 操作
"""
import json
import logging
from datetime import date
from sqlalchemy import text, update

from backend.extensions import get_session
from backend.models.word import Word, WordRelation

logger = logging.getLogger(__name__)


def db_insert_word(word_text, source, user_id=1):
    """插入新单词

    Args:
        word_text: 单词文本
        source: 单词来源
        user_id: 用户ID

    Returns:
        dict: 新插入的单词字典，成功时返回
        None: 单词已存在时返回

    Raises:
        Exception: 数据库操作失败时抛出，由调用方处理
    """
    with get_session() as db:
        # 检查同一用户同一来源是否已存在该单词
        existing = db.query(Word).filter(
            Word.user_id == user_id,
            Word.word == word_text,
            Word.source == source
        ).first()
        if existing:
            logger.debug(f"Word '{word_text}' already exists for user_id={user_id}, source={source}")
            return None

        today = date.today()
        new_word = Word(user_id=user_id, word=word_text, source=source, next_review=today)
        db.add(new_word)
        db.commit()

        new_word = db.query(Word).filter(
            Word.user_id == user_id,
            Word.word == word_text,
            Word.source == source
        ).first()
        return new_word.to_dict()


def db_delete_word(word_id: int, user_id: int = None):
    """删除单词及其关联数据

    Args:
        word_id: 单词ID
        user_id: 用户ID（可选，如果提供则按用户过滤）
    """
    from backend.models.word import RelationGenerationLog

    with get_session() as db:
        # 1. 删除words_relations中相关的记录
        rel_query = db.query(WordRelation).filter(
            (WordRelation.word_id == word_id)
            | (WordRelation.related_word_id == word_id)
        )
        if user_id is not None:
            rel_query = rel_query.filter(WordRelation.user_id == user_id)
        rel_query.delete(synchronize_session=False)

        # 2. 删除relation_generation_log中的记录
        log_query = db.query(RelationGenerationLog).filter(
            RelationGenerationLog.word_id == word_id
        )
        if user_id is not None:
            log_query = log_query.filter(RelationGenerationLog.user_id == user_id)
        log_query.delete(synchronize_session=False)

        # 3. 删除单词本身
        word_query = db.query(Word).filter(Word.id == word_id)
        if user_id is not None:
            word_query = word_query.filter(Word.user_id == user_id)
        rows = word_query.delete()
        db.commit()
        return rows > 0


def db_update_word(word_id: int, update_data: dict, user_id: int = None):
    """更新单词字段

    Args:
        word_id: 单词ID
        update_data: 更新数据字典
        user_id: 用户ID（可选，如果提供则按用户过滤）
    """
    if not update_data:
        return "没有提供更新字段。", 400, None

    # 如果 definition 是 dict，序列化为 JSON 字符串
    if "definition" in update_data and isinstance(update_data["definition"], dict):
        update_data = update_data.copy()  # 避免修改原始数据
        update_data["definition"] = json.dumps(update_data["definition"], ensure_ascii=False)

    # 构建 SET 子句，使用命名参数
    set_clause = ", ".join([f'"{key}" = :{key}' for key in update_data.keys()])

    # 构建 WHERE 子句
    where_clause = "id = :id"
    if user_id is not None:
        where_clause += " AND user_id = :user_id"

    sql_query = f'UPDATE "words" SET {set_clause} WHERE {where_clause}'

    # 构建参数字典
    params = update_data.copy()
    params["id"] = word_id
    if user_id is not None:
        params["user_id"] = user_id

    try:
        with get_session() as db:
            # 执行 UPDATE
            result = db.execute(text(sql_query), params)
            db.commit()
            if result.rowcount == 0:
                return f"未找到ID为 {word_id} 的单词。", 404, None

            # 查询并返回完整的单词对象
            word_query = db.query(Word).filter(Word.id == word_id)
            if user_id is not None:
                word_query = word_query.filter(Word.user_id == user_id)
            updated_word_result = word_query.first()

            if updated_word_result:
                updated_word = updated_word_result.to_dict()
                # 释义获取已改为前端同步调用 POST /words/<id>/fetch-definition
                return "更新成功", 200, updated_word
            else:
                return "更新成功，但无法查询到更新后的单词。", 500, None

    except Exception as e:
        db.rollback()
        return f"发生错误: {str(e)}", 500, None


def db_update_word_definition_only(word_id, definition_dict, user_id: int = None):
    """
    仅更新单词的释义字段

    Args:
        word_id: 单词ID
        definition_dict: 释义字典对象
        user_id: 用户ID（可选，如果提供则按用户过滤）

    Returns:
        bool: 是否成功
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        definition_str = json.dumps(definition_dict, ensure_ascii=False)
        with get_session() as db:
            stmt = update(Word).values(definition=definition_str).where(Word.id == word_id)
            if user_id is not None:
                stmt = stmt.where(Word.user_id == user_id)
            db.execute(stmt)
            db.commit()
        return True
    except Exception as e:
        logger.error(f"Failed to update definition for word_id={word_id}: {e}")
        return False
