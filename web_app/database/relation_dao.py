# -*- coding: utf-8 -*-
"""
单词关系数据访问层
"""
from typing import List, Optional
from sqlalchemy import and_, or_
from web_app.extensions import get_session
from web_app.models.word import Word, WordRelation, RelationType


def db_get_relations_graph(relation_types: Optional[List[str]] = None, word_id: Optional[int] = None, max_depth: int = 2):
    """
    获取单词关系图数据

    参数:
    - relation_types: 关系类型列表 (None表示全部)
    - word_id: 中心单词ID (None表示全部单词)
    - max_depth: 关系深度 (1-3)

    返回:
    {
        "nodes": [{"id": int, "word": str}],
        "edges": [{"source": int, "target": int, "relation_type": str, "confidence": float}]
    }
    """
    with get_session() as db:
        nodes = []
        edges = []
        visited_words = set()

        # 如果指定了中心单词，使用BFS获取指定深度的子图
        if word_id is not None:
            # BFS队列：(word_id, depth)
            queue = [(word_id, 0)]
            visited_words.add(word_id)

            while queue:
                current_id, depth = queue.pop(0)

                # 获取当前单词信息
                word = db.query(Word).filter(Word.id == current_id).first()
                if not word:
                    continue

                nodes.append({
                    "id": word.id,
                    "word": word.word
                })

                # 如果还没达到最大深度，继续探索
                if depth < max_depth:
                    # 查询正向和反向关系
                    relations_query = db.query(WordRelation).filter(
                        or_(
                            WordRelation.word_id == current_id,
                            WordRelation.related_word_id == current_id
                        )
                    )

                    # 过滤关系类型
                    if relation_types:
                        relations_query = relations_query.filter(
                            WordRelation.relation_type.in_([RelationType[rt] for rt in relation_types])
                        )

                    relations = relations_query.all()

                    for rel in relations:
                        # 确定source和target
                        if rel.word_id == current_id:
                            source_id = rel.word_id
                            target_id = rel.related_word_id
                        else:
                            source_id = rel.related_word_id
                            target_id = rel.word_id

                        # 获取关联单词
                        related_word = db.query(Word).filter(Word.id == target_id).first()
                        if not related_word:
                            continue

                        # 添加边
                        edges.append({
                            "source": source_id,
                            "target": target_id,
                            "relation_type": rel.relation_type.value,
                            "confidence": rel.confidence
                        })

                        # 如果关联单词未访问过，加入队列
                        if target_id not in visited_words:
                            visited_words.add(target_id)
                            queue.append((target_id, depth + 1))
        else:
            # 获取所有单词
            words = db.query(Word).all()

            # 构建nodes
            word_id_set = {w.id for w in words}
            for word in words:
                nodes.append({
                    "id": word.id,
                    "word": word.word
                })
                visited_words.add(word.id)

            # 获取所有关系
            relations_query = db.query(WordRelation)

            # 过滤关系类型
            if relation_types:
                relations_query = relations_query.filter(
                    WordRelation.relation_type.in_([RelationType[rt] for rt in relation_types])
                )

            relations = relations_query.all()

            # 构建edges（确保两端都在word_id_set中）
            for rel in relations:
                if rel.word_id in word_id_set and rel.related_word_id in word_id_set:
                    edges.append({
                        "source": rel.word_id,
                        "target": rel.related_word_id,
                        "relation_type": rel.relation_type.value,
                        "confidence": rel.confidence
                    })

        return {
            "nodes": nodes,
            "edges": edges
        }


def db_add_relation(word_id: int, related_word_id: int, relation_type: str, confidence: float = 1.0):
    """添加单条关系"""
    with get_session() as db:
        # 检查是否已存在
        existing = db.query(WordRelation).filter(
            WordRelation.word_id == word_id,
            WordRelation.related_word_id == related_word_id,
            WordRelation.relation_type == RelationType[relation_type]
        ).first()

        if existing:
            return {"success": False, "message": "关系已存在"}

        # 检查单词是否存在
        word = db.query(Word).filter(Word.id == word_id).first()
        related_word = db.query(Word).filter(Word.id == related_word_id).first()

        if not word or not related_word:
            return {"success": False, "message": "单词不存在"}

        # 创建关系
        relation = WordRelation(
            word_id=word_id,
            related_word_id=related_word_id,
            relation_type=RelationType[relation_type],
            confidence=confidence
        )

        db.add(relation)
        db.commit()

        return {
            "success": True,
            "data": {
                "id": relation.id,
                "word_id": relation.word_id,
                "related_word_id": relation.related_word_id,
                "relation_type": relation.relation_type.value,
                "confidence": relation.confidence
            }
        }


def db_delete_relation(word_id: int, related_word_id: int, relation_type: str):
    """删除单条关系"""
    with get_session() as db:
        relation = db.query(WordRelation).filter(
            WordRelation.word_id == word_id,
            WordRelation.related_word_id == related_word_id,
            WordRelation.relation_type == RelationType[relation_type]
        ).first()

        if not relation:
            return {"success": False, "message": "关系不存在"}

        db.delete(relation)
        db.commit()

        return {"success": True, "message": "关系已删除"}


def db_clear_relations(relation_types: Optional[List[str]] = None):
    """清空指定类型的关系"""
    with get_session() as db:
        query = db.query(WordRelation)

        if relation_types:
            query = query.filter(
                WordRelation.relation_type.in_([RelationType[rt] for rt in relation_types])
            )

        count = query.delete(synchronize_session=False)
        db.commit()

        return {"success": True, "count": count, "message": f"已删除 {count} 条关系"}


def db_get_relation_stats():
    """获取关系统计信息"""
    with get_session() as db:
        stats = {}

        for rel_type in RelationType:
            count = db.query(WordRelation).filter(
                WordRelation.relation_type == rel_type
            ).count()
            stats[rel_type.value] = count

        total = db.query(WordRelation).count()
        stats['total'] = total

        return stats
