# -*- coding: utf-8 -*-
"""
单词 CRUD 操作
"""
import json
from datetime import date
from sqlalchemy import text, update

from backend.extensions import get_session
from backend.models.word import Word, WordRelation


def db_insert_word(word_text, source):
    """插入新单词"""
    try:
        with get_session() as db:
            existing = db.query(Word).filter(Word.word == word_text).first()
            if existing:
                return None
            today = date.today()
            new_word = Word(word=word_text, source=source, next_review=today)
            db.add(new_word)
            db.commit()

            new_word = db.query(Word).filter(Word.word == word_text).first()
            return new_word.to_dict()
    except Exception:
        db.rollback()
        return None


def db_delete_word(word_id: int):
    """删除单词及其关联数据"""
    from backend.models.word import RelationGenerationLog

    with get_session() as db:
        # 1. 删除words_relations中相关的记录
        db.query(WordRelation).filter(
            (WordRelation.word_id == word_id)
            | (WordRelation.related_word_id == word_id)
        ).delete(synchronize_session=False)

        # 2. 删除relation_generation_log中的记录
        db.query(RelationGenerationLog).filter(
            RelationGenerationLog.word_id == word_id
        ).delete(synchronize_session=False)

        # 3. 删除单词本身
        rows = db.query(Word).filter(Word.id == word_id).delete()
        db.commit()
        return rows > 0


def db_update_word(word_id: int, update_data: dict):
    """更新单词字段"""
    if not update_data:
        return "没有提供更新字段。", 400, None

    # 构建 SET 子句，使用命名参数
    set_clause = ", ".join([f'"{key}" = :{key}' for key in update_data.keys()])
    sql_query = f'UPDATE "words" SET {set_clause} WHERE id = :id'

    # 构建参数字典
    params = update_data.copy()
    params["id"] = word_id

    try:
        with get_session() as db:
            # 如果更新数据包含word字段，先查询原始的word文本
            original_word = None
            if "word" in update_data:
                original_word_result = (
                    db.query(Word.word).filter(Word.id == word_id).first()
                )
                if original_word_result:
                    original_word = original_word_result[0]

            # 执行 UPDATE
            result = db.execute(text(sql_query), params)
            db.commit()
            if result.rowcount == 0:
                return f"未找到ID为 {word_id} 的单词。", 404, None

            # 查询并返回完整的单词对象
            updated_word_result = db.query(Word).filter(Word.id == word_id).first()

            if updated_word_result:
                updated_word = updated_word_result.to_dict()
                # 释义获取已改为前端同步调用 POST /words/<id>/fetch-definition
                return "更新成功", 200, updated_word
            else:
                return "更新成功，但无法查询到更新后的单词。", 500, None

    except Exception as e:
        db.rollback()
        return f"发生错误: {str(e)}", 500, None


def db_update_word_definition_only(word_id, definition_dict):
    """
    仅更新单词的释义字段

    Args:
        word_id: 单词ID
        definition_dict: 释义字典对象

    Returns:
        bool: 是否成功
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        definition_str = json.dumps(definition_dict, ensure_ascii=False)
        with get_session() as db:
            db.execute(
                update(Word).values(definition=definition_str).where(Word.id == word_id)
            )
            db.commit()
        return True
    except Exception as e:
        logger.error(f"Failed to update definition for word_id={word_id}: {e}")
        return False
