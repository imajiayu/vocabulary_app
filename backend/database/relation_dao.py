# -*- coding: utf-8 -*-
"""
单词关系数据访问层
"""
import json
from typing import List, Optional
from sqlalchemy import text
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

        # 如果指定了中心单词，使用递归 CTE 单次查询获取子图
        if word_id is not None:
            # 构建关系类型过滤条件
            type_filter = ""
            params = {"seed_id": word_id, "user_id": user_id, "max_depth": max_depth}
            if relation_types:
                type_placeholders = ", ".join(f":rt{i}" for i in range(len(relation_types)))
                type_filter = f"AND r.relation_type IN ({type_placeholders})"
                for i, rt in enumerate(relation_types):
                    params[f"rt{i}"] = rt

            # 递归 CTE: BFS 遍历关系图
            # 1) bfs: 从种子节点出发，逐层展开（限制 max_depth 层）
            # 2) 收集所有涉及的节点 ID + 所有边
            cte_sql = text(f"""
                WITH RECURSIVE bfs AS (
                    -- 种子层：起始节点
                    SELECT :seed_id AS node_id, 0 AS depth

                    UNION ALL

                    -- 递归层：从当前层节点沿关系展开
                    SELECT r.related_word_id AS node_id, bfs.depth + 1 AS depth
                    FROM bfs
                    JOIN words_relations r ON r.word_id = bfs.node_id
                        AND r.user_id = :user_id
                        {type_filter}
                    WHERE bfs.depth < :max_depth
                ),
                -- 去重收集所有可达节点
                reachable AS (
                    SELECT DISTINCT node_id FROM bfs
                )
                -- 返回所有可达节点的信息
                SELECT w.id, w.word, w.definition
                FROM words w
                JOIN reachable rn ON rn.node_id = w.id
                WHERE w.user_id = :user_id
            """)

            rows = db.execute(cte_sql, params).fetchall()
            if not rows:
                return {"nodes": [], "edges": []}

            node_ids = set()
            for row in rows:
                node_ids.add(row[0])
                nodes.append({
                    "id": row[0],
                    "word": row[1],
                    "definition": _extract_definitions(row[2])
                })

            # 获取所有可达节点之间的边（去重：只取 word_id < related_word_id）
            edge_type_filter = ""
            edge_params = {"user_id": user_id}
            if relation_types:
                edge_type_filter = f"AND r.relation_type IN ({type_placeholders})"
                for i, rt in enumerate(relation_types):
                    edge_params[f"rt{i}"] = rt

            # 使用 IN 子句过滤边的两端都在可达节点中
            id_placeholders = ", ".join(f":nid{i}" for i in range(len(node_ids)))
            for i, nid in enumerate(node_ids):
                edge_params[f"nid{i}"] = nid

            edge_sql = text(f"""
                SELECT r.word_id, r.related_word_id, r.relation_type, r.confidence
                FROM words_relations r
                WHERE r.user_id = :user_id
                    AND r.word_id < r.related_word_id
                    AND r.word_id IN ({id_placeholders})
                    AND r.related_word_id IN ({id_placeholders})
                    {edge_type_filter}
            """)

            edge_rows = db.execute(edge_sql, edge_params).fetchall()
            for erow in edge_rows:
                edges.append({
                    "source": erow[0],
                    "target": erow[1],
                    "relation_type": erow[2] if isinstance(erow[2], str) else erow[2].value,
                    "confidence": float(erow[3])
                })
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
