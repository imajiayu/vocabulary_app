# -*- coding: utf-8 -*-
"""
关系生成器通用工具函数
"""
import logging
from sqlalchemy import insert
from web_app.models.word import WordRelation

logger = logging.getLogger(__name__)


def batch_insert_relations(session, relations: list, batch_size: int = 1000):
    """
    批量插入关系，自动创建双向关系（无向图实现）
    - 对每个关系，同时插入正向和反向两条记录
    - 重复自动忽略（通过 INSERT OR IGNORE）
    """
    if not relations:
        return

    total = len(relations)
    logger.info(f"开始批量插入 {total} 条关系（将创建 {total * 2} 条数据库记录）...")

    for i in range(0, total, batch_size):
        batch = relations[i : i + batch_size]

        # 为每个关系创建双向记录
        bidirectional_batch = []
        for rel in batch:
            # 正向关系
            bidirectional_batch.append(rel.__dict__)

            # 反向关系
            reverse_rel_dict = {
                'word_id': rel.related_word_id,
                'related_word_id': rel.word_id,
                'relation_type': rel.relation_type,
                'confidence': rel.confidence
            }
            bidirectional_batch.append(reverse_rel_dict)

        # 批量插入（使用 INSERT OR IGNORE 避免重复）
        stmt = insert(WordRelation.__table__).prefix_with("OR IGNORE")
        session.execute(stmt, bidirectional_batch)
        session.commit()
        logger.info(f"已插入 {min(i+batch_size, total)}/{total} 条关系（{min((i+batch_size)*2, total*2)} 条数据库记录）")
