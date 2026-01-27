# -*- coding: utf-8 -*-
"""
单词查询操作

注意：所有函数需要 user_id 参数进行用户数据隔离
"""
from sqlalchemy.orm import joinedload

from backend.extensions import get_session
from backend.models.word import Word, WordRelation


def db_fetch_word_info(word_id, user_id):
    """获取单词基本信息"""
    with get_session() as db:
        w = db.query(Word).filter_by(id=word_id, user_id=user_id).first()
        return w.to_dict() if w else None


def db_get_word_text_only(word_id, user_id):
    """轻量级查询：仅获取单词文本（用于验证存在性）

    优化：仅查询 id 和 word 字段，不加载完整对象
    """
    with get_session() as db:
        result = db.query(Word.id, Word.word).filter(
            Word.id == word_id, Word.user_id == user_id
        ).first()
        if not result:
            return None
        return {"id": result.id, "word": result.word}


def db_get_word_review_info(id, user_id):
    """获取单词复习信息（含关联词）

    优化：使用 eager loading 预加载关联词
    """
    with get_session() as db:
        w = (
            db.query(Word)
            .filter(Word.id == id, Word.user_id == user_id)
            .options(
                joinedload(Word.related_words).joinedload(WordRelation.related_word)
            )
            .first()
        )
        if not w:
            return None

        res = w.to_dict()
        # 关联词已预加载
        res["related_words"] = [
            {
                "id": rel.related_word.id,
                "word": rel.related_word.word,
                "relation_type": rel.relation_type.value,
                "confidence": rel.confidence,
            }
            for rel in w.related_words
        ]
        return res


def db_get_words_review_info_batch(word_ids, user_id):
    """批量获取单词复习信息

    优化：使用 eager loading 预加载关联词，避免 N+1 查询
    原来：1 + 4N 次查询 → 优化后：1 次查询
    """
    if not word_ids:
        return []

    with get_session() as db:
        # 使用 joinedload 预加载关联词关系和关联词本身
        words = (
            db.query(Word)
            .filter(Word.id.in_(word_ids), Word.user_id == user_id)
            .options(
                joinedload(Word.related_words).joinedload(WordRelation.related_word)
            )
            .all()
        )

        # 创建映射以快速查找
        word_dict = {word.id: word for word in words}
        result = []

        # 保持原始顺序
        for word_id in word_ids:
            if word_id in word_dict:
                word = word_dict[word_id]
                res = word.to_dict()
                # 关联词已预加载，访问不会触发额外查询
                res["related_words"] = [
                    {
                        "id": rel.related_word.id,
                        "word": rel.related_word.word,
                        "relation_type": rel.relation_type.value,
                        "confidence": rel.confidence,
                    }
                    for rel in word.related_words
                ]
                result.append(res)

        return result


def db_get_word_elapse_info(id, user_id):
    """获取单词的时间统计信息"""
    with get_session() as db:
        row = (
            db.query(Word.avg_elapsed_time, Word.remember_count, Word.forget_count)
            .filter(Word.id == id, Word.user_id == user_id)
            .first()
        )
        if not row:
            return None
        return row.avg_elapsed_time, row.remember_count, row.forget_count
