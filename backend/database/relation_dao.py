# -*- coding: utf-8 -*-
"""
单词关系数据访问层
"""
import json
from typing import List, Optional
from backend.extensions import get_session
from backend.models.word import Word, WordRelation, RelationType


def _extract_definitions(definition_json: str) -> str:
    """
    从JSON字符串中提取释义数组并连接成字符串

    参数:
    - definition_json: JSON格式的定义字符串

    返回:
    - 释义字符串，多个释义用分号分隔
    """
    if not definition_json:
        return ""

    try:
        data = json.loads(definition_json)
        definitions = data.get("definitions", [])
        return "; ".join(definitions) if definitions else ""
    except (json.JSONDecodeError, KeyError, TypeError):
        return ""


def db_get_relations_graph(relation_types: Optional[List[str]] = None, word_id: Optional[int] = None, max_depth: int = 2, user_id: str = ""):
    """
    获取单词关系图数据（双向存储下的去重实现）

    参数:
    - relation_types: 关系类型列表 (None表示全部)
    - word_id: 中心单词ID (None表示全部单词)
    - max_depth: 关系深度 (1-3)
    - user_id: 用户ID

    返回:
    {
        "nodes": [{"id": int, "word": str}],
        "edges": [{"source": int, "target": int, "relation_type": str, "confidence": float}]
    }

    注意：虽然数据库中每条边存储了两次（正向+反向），但返回时会去重，只返回一条边
    """
    with get_session() as db:
        nodes = []
        edges = []
        visited_words = set()
        # 用于去重的边集合：(min_id, max_id, relation_type)
        edge_set = set()

        # 如果指定了中心单词，使用BFS获取指定深度的子图（批量加载）
        if word_id is not None:
            # 转换关系类型过滤列表
            relation_type_enums = [RelationType[rt] for rt in relation_types] if relation_types else None

            # 第一步：加载种子节点
            seed_word = db.query(Word).filter(Word.id == word_id, Word.user_id == user_id).first()
            if not seed_word:
                return {"nodes": [], "edges": []}

            nodes.append({
                "id": seed_word.id,
                "word": seed_word.word,
                "definition": _extract_definitions(seed_word.definition)
            })
            visited_words.add(word_id)

            # BFS 逐层批量处理
            current_layer_ids = [word_id]

            for depth in range(max_depth):
                if not current_layer_ids:
                    break

                # 批量获取当前层所有节点的关系
                relations_query = db.query(WordRelation).filter(
                    WordRelation.word_id.in_(current_layer_ids),
                    WordRelation.user_id == user_id
                )
                if relation_type_enums:
                    relations_query = relations_query.filter(
                        WordRelation.relation_type.in_(relation_type_enums)
                    )
                relations = relations_query.all()

                # 收集需要加载的下一层节点 ID，同时处理边去重
                next_layer_ids = set()
                pending_edges = []

                for rel in relations:
                    source_id = rel.word_id
                    target_id = rel.related_word_id

                    edge_key = (
                        min(source_id, target_id),
                        max(source_id, target_id),
                        rel.relation_type.value
                    )
                    if edge_key in edge_set:
                        continue
                    edge_set.add(edge_key)

                    pending_edges.append({
                        "source": source_id,
                        "target": target_id,
                        "relation_type": rel.relation_type.value,
                        "confidence": rel.confidence,
                        "_target_id": target_id
                    })

                    if target_id not in visited_words:
                        next_layer_ids.add(target_id)

                # 批量加载下一层节点
                if next_layer_ids:
                    next_words = db.query(Word).filter(
                        Word.id.in_(list(next_layer_ids)),
                        Word.user_id == user_id
                    ).all()
                    valid_target_ids = set()
                    for w in next_words:
                        valid_target_ids.add(w.id)
                        visited_words.add(w.id)
                        nodes.append({
                            "id": w.id,
                            "word": w.word,
                            "definition": _extract_definitions(w.definition)
                        })

                    # 只保留目标节点存在的边
                    for pe in pending_edges:
                        tid = pe.pop("_target_id")
                        if tid in visited_words:
                            edges.append(pe)

                    current_layer_ids = list(valid_target_ids)
                else:
                    # 没有新节点，但仍需添加指向已访问节点的边
                    for pe in pending_edges:
                        tid = pe.pop("_target_id")
                        if tid in visited_words:
                            edges.append(pe)
                    break
        else:
            # 获取当前用户的所有单词
            words = db.query(Word).filter(Word.user_id == user_id).all()

            # 构建nodes
            word_id_set = {w.id for w in words}
            for word in words:
                nodes.append({
                    "id": word.id,
                    "word": word.word,
                    "definition": _extract_definitions(word.definition)
                })
                visited_words.add(word.id)

            # 获取所有关系（只查询 word_id < related_word_id 的记录，自然去重）
            relations_query = db.query(WordRelation).filter(
                WordRelation.user_id == user_id,
                WordRelation.word_id < WordRelation.related_word_id
            )

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


