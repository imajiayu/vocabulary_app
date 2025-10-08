# -*- coding: utf-8 -*-
"""
关系生成器通用工具函数
"""


def batch_insert_relations(relations: list, batch_size: int = 1000):
    """
    批量插入关系（通过DAO层）

    参数:
    - relations: WordRelation对象列表
    - batch_size: 批量插入的大小
    """
    from web_app.database.relation_dao import db_batch_insert_relations

    if not relations:
        return

    # 将 WordRelation 对象转换为字典格式
    relations_data = [
        {
            'word_id': rel.word_id,
            'related_word_id': rel.related_word_id,
            'relation_type': rel.relation_type,
            'confidence': rel.confidence
        }
        for rel in relations
    ]

    # 调用DAO层函数
    db_batch_insert_relations(relations_data, batch_size)
