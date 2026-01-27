# -*- coding: utf-8 -*-
"""
单词关系数据访问层
"""
import json
from typing import List, Optional, Dict
from sqlalchemy import and_, or_
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


def db_get_relations_graph(relation_types: Optional[List[str]] = None, word_id: Optional[int] = None, max_depth: int = 2, user_id: int = 1):
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

        # 如果指定了中心单词，使用BFS获取指定深度的子图
        if word_id is not None:
            # BFS队列：(word_id, depth)
            queue = [(word_id, 0)]
            visited_words.add(word_id)

            while queue:
                current_id, depth = queue.pop(0)

                # 获取当前单词信息（按用户过滤）
                word = db.query(Word).filter(Word.id == current_id, Word.user_id == user_id).first()
                if not word:
                    continue

                nodes.append({
                    "id": word.id,
                    "word": word.word,
                    "definition": _extract_definitions(word.definition)
                })

                # 如果还没达到最大深度，继续探索
                if depth < max_depth:
                    # 只查询正向关系（因为双向存储，只需查一个方向即可）
                    relations_query = db.query(WordRelation).filter(
                        WordRelation.word_id == current_id,
                        WordRelation.user_id == user_id
                    )

                    # 过滤关系类型
                    if relation_types:
                        relations_query = relations_query.filter(
                            WordRelation.relation_type.in_([RelationType[rt] for rt in relation_types])
                        )

                    relations = relations_query.all()

                    for rel in relations:
                        source_id = rel.word_id
                        target_id = rel.related_word_id

                        # 去重检查：使用规范化的边键（小ID在前）
                        edge_key = (
                            min(source_id, target_id),
                            max(source_id, target_id),
                            rel.relation_type.value
                        )

                        if edge_key in edge_set:
                            continue

                        edge_set.add(edge_key)

                        # 获取关联单词（按用户过滤）
                        related_word = db.query(Word).filter(Word.id == target_id, Word.user_id == user_id).first()
                        if not related_word:
                            continue

                        # 添加边（使用原始方向）
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


def db_add_relation(word_id: int, related_word_id: int, relation_type: str, confidence: float = 1.0, user_id: int = 1):
    """
    添加单条关系（双向存储实现）
    - 同时创建正向和反向两条记录
    - 实现无向图语义

    Args:
        word_id: 单词ID
        related_word_id: 关联单词ID
        relation_type: 关系类型
        confidence: 置信度
        user_id: 用户ID
    """
    with get_session() as db:
        # 检查是否已存在（正向或反向都检查，按用户过滤）
        existing = db.query(WordRelation).filter(
            WordRelation.user_id == user_id,
            or_(
                and_(
                    WordRelation.word_id == word_id,
                    WordRelation.related_word_id == related_word_id,
                    WordRelation.relation_type == RelationType[relation_type]
                ),
                and_(
                    WordRelation.word_id == related_word_id,
                    WordRelation.related_word_id == word_id,
                    WordRelation.relation_type == RelationType[relation_type]
                )
            )
        ).first()

        if existing:
            return {"success": False, "message": "关系已存在"}

        # 检查单词是否存在（按用户过滤）
        word = db.query(Word).filter(Word.id == word_id, Word.user_id == user_id).first()
        related_word = db.query(Word).filter(Word.id == related_word_id, Word.user_id == user_id).first()

        if not word or not related_word:
            return {"success": False, "message": "单词不存在"}

        # 创建双向关系
        # 正向关系
        relation_forward = WordRelation(
            word_id=word_id,
            related_word_id=related_word_id,
            relation_type=RelationType[relation_type],
            confidence=confidence,
            user_id=user_id
        )

        # 反向关系
        relation_backward = WordRelation(
            word_id=related_word_id,
            related_word_id=word_id,
            relation_type=RelationType[relation_type],
            confidence=confidence,
            user_id=user_id
        )

        db.add(relation_forward)
        db.add(relation_backward)
        db.commit()

        return {
            "success": True,
            "data": {
                "id": relation_forward.id,
                "word_id": relation_forward.word_id,
                "related_word_id": relation_forward.related_word_id,
                "relation_type": relation_forward.relation_type.value,
                "confidence": relation_forward.confidence
            }
        }


def db_delete_relation(word_id: int, related_word_id: int, relation_type: str, user_id: int = 1):
    """
    删除单条关系（双向删除实现）
    - 同时删除正向和反向两条记录
    - 实现无向图语义

    Args:
        word_id: 单词ID
        related_word_id: 关联单词ID
        relation_type: 关系类型
        user_id: 用户ID
    """
    with get_session() as db:
        # 查找正向和反向关系（按用户过滤）
        relations = db.query(WordRelation).filter(
            WordRelation.user_id == user_id,
            or_(
                and_(
                    WordRelation.word_id == word_id,
                    WordRelation.related_word_id == related_word_id,
                    WordRelation.relation_type == RelationType[relation_type]
                ),
                and_(
                    WordRelation.word_id == related_word_id,
                    WordRelation.related_word_id == word_id,
                    WordRelation.relation_type == RelationType[relation_type]
                )
            )
        ).all()

        if not relations:
            return {"success": False, "message": "关系不存在"}

        # 删除所有找到的关系（正向+反向）
        for relation in relations:
            db.delete(relation)

        db.commit()

        return {"success": True, "message": f"关系已删除（删除了 {len(relations)} 条数据库记录）"}


def db_get_relation_stats(user_id: int = 1):
    """
    获取关系统计信息（去重后的实际关系数）

    由于双向存储，每条关系在数据库中存储了2条记录
    统计时需要除以2来得到实际的关系数量
    """
    with get_session() as db:
        stats = {}

        for rel_type in RelationType:
            # 统计数据库记录数（按用户过滤）
            db_count = db.query(WordRelation).filter(
                WordRelation.user_id == user_id,
                WordRelation.relation_type == rel_type
            ).count()
            # 除以2得到实际关系数（因为每条关系存储了正向+反向）
            stats[rel_type.value] = db_count // 2

        # 总数也需要除以2
        total_db_count = db.query(WordRelation).filter(WordRelation.user_id == user_id).count()
        stats['total'] = total_db_count // 2

        return stats


def db_get_all_words(user_id: int = 1):
    """
    获取所有单词列表（用于关系生成）

    返回:
    - List[Word]: 单词对象列表
    """
    with get_session() as db:
        words = db.query(Word).filter(Word.user_id == user_id).all()
        # 返回副本，避免session关闭后访问问题
        return [
            {
                'id': w.id,
                'word': w.word,
                'definition': w.definition
            }
            for w in words
        ]




def db_get_unprocessed_word_ids(relation_type: RelationType, user_id: int = 1) -> List[int]:
    """
    获取指定关系类型中尚未处理的单词ID列表

    参数:
    - relation_type: 关系类型
    - user_id: 用户ID

    返回:
    - List[int]: 未处理的word_id列表
    """
    from backend.models.word import RelationGenerationLog
    from sqlalchemy import select

    with get_session() as db:
        # 子查询：该用户已处理的word_id
        processed_subquery = select(RelationGenerationLog.word_id).filter(
            RelationGenerationLog.relation_type == relation_type,
            RelationGenerationLog.user_id == user_id
        ).scalar_subquery()

        # 主查询：找出该用户所有未在日志中的单词
        unprocessed_words = db.query(Word.id).filter(
            Word.user_id == user_id,
            ~Word.id.in_(processed_subquery)
        ).all()

        return [w[0] for w in unprocessed_words]


def db_mark_words_processed(word_ids: List[int], relation_type: RelationType, found_counts: Dict[int, int] = None, user_id: int = 1):
    """
    标记单词为已处理状态

    参数:
    - word_ids: 单词ID列表
    - relation_type: 关系类型
    - found_counts: 每个单词找到的关系数 {word_id: count}
    - user_id: 用户ID
    """
    from backend.models.word import RelationGenerationLog
    from datetime import datetime
    from sqlalchemy import insert

    if not word_ids:
        return

    with get_session() as db:
        logs = []
        for word_id in word_ids:
            logs.append({
                'user_id': user_id,
                'word_id': word_id,
                'relation_type': relation_type,
                'processed_at': datetime.now(),
                'found_count': found_counts.get(word_id, 0) if found_counts else 0
            })

        # 批量插入（使用 INSERT OR REPLACE 更新已存在的记录）
        stmt = insert(RelationGenerationLog.__table__).prefix_with("OR REPLACE")
        db.execute(stmt, logs)
        db.commit()


def db_check_relation_exists(word_id: int, related_word_id: int, relation_type: RelationType, user_id: int = 1) -> bool:
    """
    检查关系是否已存在（检查正向或反向任一方向）

    参数:
    - word_id: 单词ID
    - related_word_id: 关联单词ID
    - relation_type: 关系类型
    - user_id: 用户ID

    返回:
    - bool: 关系是否存在
    """
    with get_session() as db:
        exists = db.query(WordRelation).filter(
            WordRelation.user_id == user_id,
            or_(
                and_(
                    WordRelation.word_id == word_id,
                    WordRelation.related_word_id == related_word_id,
                    WordRelation.relation_type == relation_type
                ),
                and_(
                    WordRelation.word_id == related_word_id,
                    WordRelation.related_word_id == word_id,
                    WordRelation.relation_type == relation_type
                )
            )
        ).first()
        return exists is not None


def db_batch_check_relations_exist(relations_data: List[Dict], user_id: int = 1) -> Dict:
    """
    批量检查关系是否存在（分批处理以避免SQL表达式树过深）

    参数:
    - relations_data: 关系数据列表，每个元素格式：
      {
          'word_id': int,
          'related_word_id': int,
          'relation_type': RelationType
      }
    - user_id: 用户ID

    返回:
    - Dict: 键为 (word_id, related_word_id, relation_type)，值为 bool
    """
    if not relations_data:
        return {}

    result = {}
    CHUNK_SIZE = 200  # 每次查询最多200个关系（每个关系有2个OR条件，共400个条件，安全低于1000限制）

    with get_session() as db:
        # 分批处理
        for i in range(0, len(relations_data), CHUNK_SIZE):
            chunk = relations_data[i:i + CHUNK_SIZE]

            # 构建查询条件
            conditions = []
            for rel in chunk:
                # 检查正向或反向
                conditions.append(
                    or_(
                        and_(
                            WordRelation.word_id == rel['word_id'],
                            WordRelation.related_word_id == rel['related_word_id'],
                            WordRelation.relation_type == rel['relation_type']
                        ),
                        and_(
                            WordRelation.word_id == rel['related_word_id'],
                            WordRelation.related_word_id == rel['word_id'],
                            WordRelation.relation_type == rel['relation_type']
                        )
                    )
                )

            # 执行查询
            if conditions:
                existing_relations = db.query(
                    WordRelation.word_id,
                    WordRelation.related_word_id,
                    WordRelation.relation_type
                ).filter(
                    WordRelation.user_id == user_id,
                    or_(*conditions)
                ).all()

                # 构建存在性字典
                exists_dict = {}
                for word_id, related_word_id, relation_type in existing_relations:
                    # 标准化键（使用最小ID在前）
                    key = (
                        min(word_id, related_word_id),
                        max(word_id, related_word_id),
                        relation_type
                    )
                    exists_dict[key] = True

                # 为这一批关系设置存在性
                for rel in chunk:
                    key = (
                        min(rel['word_id'], rel['related_word_id']),
                        max(rel['word_id'], rel['related_word_id']),
                        rel['relation_type']
                    )
                    result[key] = key in exists_dict

    return result


def db_batch_insert_relations(relations_data: List[Dict], batch_size: int = 1000):
    """
    批量插入关系，自动创建双向关系（无向图实现）

    参数:
    - relations_data: 关系数据列表，每个元素格式：
      {
          'word_id': int,
          'related_word_id': int,
          'relation_type': RelationType,
          'confidence': float
      }
    - batch_size: 批量插入的大小

    返回:
    - int: 实际插入的关系数（注意：数据库记录数是这个的2倍）
    """
    from sqlalchemy import insert
    import logging

    logger = logging.getLogger(__name__)

    if not relations_data:
        return 0

    total = len(relations_data)
    logger.info(f"开始批量插入 {total} 条关系（将创建 {total * 2} 条数据库记录）...")

    with get_session() as db:
        for i in range(0, total, batch_size):
            batch = relations_data[i : i + batch_size]

            # 为每个关系创建双向记录
            bidirectional_batch = []
            for rel in batch:
                # 正向关系
                bidirectional_batch.append({
                    'word_id': rel['word_id'],
                    'related_word_id': rel['related_word_id'],
                    'relation_type': rel['relation_type'],
                    'confidence': rel['confidence']
                })

                # 反向关系
                bidirectional_batch.append({
                    'word_id': rel['related_word_id'],
                    'related_word_id': rel['word_id'],
                    'relation_type': rel['relation_type'],
                    'confidence': rel['confidence']
                })

            # 批量插入（使用 INSERT OR IGNORE 避免重复）
            stmt = insert(WordRelation.__table__).prefix_with("OR IGNORE")
            db.execute(stmt, bidirectional_batch)
            db.commit()
            logger.info(f"已插入 {min(i+batch_size, total)}/{total} 条关系（{min((i+batch_size)*2, total*2)} 条数据库记录）")

    return total


