# -*- coding: utf-8 -*-
"""
单词查询操作

注意：所有函数需要 user_id 参数进行用户数据隔离
"""
from sqlalchemy import func, case
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


def db_fetch_word_info_for_insert_page(user_id):
    """获取所有单词（用于插入页面）"""
    with get_session() as db:
        words = db.query(Word).filter(Word.user_id == user_id).order_by(Word.word.asc()).all()
    return [w.to_dict() for w in words]


def db_fetch_words_without_definition(user_id):
    """获取所有无释义的单词"""
    invalid_definition = '{"phonetic": {"us": "", "uk": ""}, "definitions": ["暂无释义"], "examples": []}'

    with get_session() as db:
        words = (
            db.query(Word)
            .filter(
                Word.user_id == user_id,
                (Word.definition == None)
                | (Word.definition == "")
                | (Word.definition == "{}")
                | (Word.definition == invalid_definition)
            )
            .all()
        )
        return [{"id": w.id, "word": w.word} for w in words]


def db_fetch_word_info_paginated(user_id, limit=50, offset=0):
    """分页获取单词列表

    优化：使用单次分组查询代替 2+2×N 次循环查询
    """
    with get_session() as db:
        # 分页查询（按用户过滤）
        words = (
            db.query(Word)
            .filter(Word.user_id == user_id)
            .order_by(Word.word.asc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        # 仅首次请求时计算统计
        counts = None
        if offset == 0:
            from backend.config import UserConfig

            # 单次分组查询获取所有 source 的统计（按用户过滤）
            results = (
                db.query(
                    Word.source,
                    func.count(Word.id).label("total"),
                    func.sum(case((Word.stop_review == 1, 1), else_=0)).label("remembered"),
                )
                .filter(Word.user_id == user_id)
                .group_by(Word.source)
                .all()
            )

            # 构建 source 统计映射
            stats_map = {r.source: {"total": r.total, "remembered": int(r.remembered or 0)} for r in results}

            # 计算全局统计
            total_count = sum(s["total"] for s in stats_map.values())
            remembered_total = sum(s["remembered"] for s in stats_map.values())

            source_counts = {
                "all": {
                    "total": total_count,
                    "remembered": remembered_total,
                    "unremembered": total_count - remembered_total,
                }
            }

            # 确保所有配置的 source 都有数据
            for source in UserConfig(user_id).CUSTOM_SOURCES:
                data = stats_map.get(source, {"total": 0, "remembered": 0})
                source_counts[source] = {
                    "total": data["total"],
                    "remembered": data["remembered"],
                    "unremembered": data["total"] - data["remembered"],
                }

            counts = {"source_counts": source_counts}
            has_more = (offset + limit) < total_count
        else:
            # 非首次请求时需要单独获取总数（按用户过滤）
            total_count = db.query(func.count(Word.id)).filter(Word.user_id == user_id).scalar()
            has_more = (offset + limit) < total_count

        return {
            "words": [w.to_dict() for w in words],
            "total": total_count,
            "has_more": has_more,
            "counts": counts,
        }


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
