# -*- coding: utf-8 -*-
"""
单词查询操作
"""
from backend.extensions import get_session
from backend.models.word import Word


def db_fetch_word_info(word_id):
    """获取单词基本信息"""
    with get_session() as db:
        w = db.query(Word).filter_by(id=word_id).first()
        return w.to_dict() if w else None


def db_get_word_review_info(id):
    """获取单词复习信息（含关联词）"""
    with get_session() as db:
        w = db.query(Word).filter(Word.id == id).first()
        if not w:
            return None

        res = w.to_dict()
        res["related_words"] = w.get_all_related_words(db)
        return res


def db_get_words_review_info_batch(word_ids):
    """批量获取单词复习信息 - 解决 N+1 查询问题"""
    if not word_ids:
        return []

    with get_session() as db:
        # 单次查询获取所有单词
        words = db.query(Word).filter(Word.id.in_(word_ids)).all()

        # 创建映射以快速查找
        word_dict = {word.id: word for word in words}
        result = []

        # 保持原始顺序
        for word_id in word_ids:
            if word_id in word_dict:
                word = word_dict[word_id]
                res = word.to_dict()
                res["related_words"] = word.get_all_related_words(db)
                result.append(res)

        return result


def db_fetch_word_info_for_insert_page():
    """获取所有单词（用于插入页面）"""
    with get_session() as db:
        words = db.query(Word).order_by(Word.word.asc()).all()
    return [w.to_dict() for w in words]


def db_fetch_words_without_definition():
    """获取所有无释义的单词"""
    invalid_definition = '{"phonetic": {"us": "", "uk": ""}, "definitions": ["暂无释义"], "examples": []}'

    with get_session() as db:
        words = (
            db.query(Word)
            .filter(
                (Word.definition == None)
                | (Word.definition == "")
                | (Word.definition == "{}")
                | (Word.definition == invalid_definition)
            )
            .all()
        )
        return [{"id": w.id, "word": w.word} for w in words]


def db_fetch_word_info_paginated(limit=50, offset=0):
    """分页获取单词列表"""
    with get_session() as db:
        # 获取总数
        total_count = db.query(Word).count()

        # 分页查询
        words = (
            db.query(Word).order_by(Word.word.asc()).offset(offset).limit(limit).all()
        )

        has_more = (offset + limit) < total_count

        # 仅首次请求时计算统计
        counts = None
        if offset == 0:
            from backend.config import UserConfig

            remembered_total = (
                db.query(Word).filter(Word.stop_review == 1).count()
            )
            unremembered_total = total_count - remembered_total

            source_counts = {
                "all": {
                    "total": total_count,
                    "remembered": remembered_total,
                    "unremembered": unremembered_total,
                }
            }

            for source in UserConfig().CUSTOM_SOURCES:
                source_total = db.query(Word).filter(Word.source == source).count()
                source_remembered = (
                    db.query(Word)
                    .filter(Word.source == source, Word.stop_review == 1)
                    .count()
                )
                source_unremembered = source_total - source_remembered

                source_counts[source] = {
                    "total": source_total,
                    "remembered": source_remembered,
                    "unremembered": source_unremembered,
                }

            counts = {"source_counts": source_counts}

        return {
            "words": [w.to_dict() for w in words],
            "total": total_count,
            "has_more": has_more,
            "counts": counts,
        }


def db_get_word_elapse_info(id):
    """获取单词的时间统计信息"""
    with get_session() as db:
        row = (
            db.query(Word.avg_elapsed_time, Word.remember_count, Word.forget_count)
            .filter(Word.id == id)
            .first()
        )
        if not row:
            return None
        return row.avg_elapsed_time, row.remember_count, row.forget_count
