# -*- coding: utf-8 -*-
"""
关系生成器通用工具函数
"""
import logging
from sqlalchemy import insert
from web_app.models.word import WordRelation

logger = logging.getLogger(__name__)


def batch_insert_relations(session, relations: list, batch_size: int = 1000):
    """批量插入关系，重复自动忽略"""
    total = len(relations)
    logger.info(f"开始批量插入 {total} 条关系...")

    for i in range(0, total, batch_size):
        batch = relations[i : i + batch_size]
        # 构造 INSERT OR IGNORE
        stmt = insert(WordRelation.__table__).prefix_with("OR IGNORE")
        session.execute(stmt, [rel.__dict__ for rel in batch])
        session.commit()
        logger.info(f"已插入 {min(i+batch_size, total)}/{total} 条关系")
