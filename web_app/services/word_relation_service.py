# -*- coding: utf-8 -*-
"""
单词关系生成服务
协调各类关系生成器的执行
"""
import logging
from typing import List, Optional
from web_app.models.word import RelationType
from web_app.database.relation_dao import db_clear_relations

logging.basicConfig(level=logging.INFO)


def generate_relations_service(relation_types: Optional[List[str]] = None):
    """
    生成指定类型的单词关系

    参数:
    - relation_types: 关系类型列表字符串 (None表示全部)

    返回:
    {
        "generated": {
            "synonym": count,
            "antonym": count,
            ...
        },
        "total": total_count
    }
    """
    # 转换字符串为 RelationType 枚举
    types_to_generate = None
    if relation_types:
        types_to_generate = [RelationType[rt] for rt in relation_types]

    # 先清空现有关系
    db_clear_relations(relation_types)

    generated_counts = {}
    total = 0

    # 按顺序生成各类关系
    if types_to_generate is None or RelationType.synonym in types_to_generate:
        count = _generate_synonym_relations()
        generated_counts['synonym'] = count
        total += count

    if types_to_generate is None or RelationType.antonym in types_to_generate:
        count = _generate_antonym_relations()
        generated_counts['antonym'] = count
        total += count

    if types_to_generate is None or RelationType.root in types_to_generate:
        count = _generate_root_relations()
        generated_counts['root'] = count
        total += count

    if types_to_generate is None or RelationType.confused in types_to_generate:
        count = _generate_confused_relations()
        generated_counts['confused'] = count
        total += count

    if types_to_generate is None or RelationType.topic in types_to_generate:
        count = _generate_topic_relations()
        generated_counts['topic'] = count
        total += count

    return {
        "generated": generated_counts,
        "total": total
    }


def _generate_synonym_relations():
    """生成同义词关系"""
    from web_app.services.relations.synonym_generator import generate_synonym_relations
    try:
        return generate_synonym_relations()
    except Exception as e:
        logging.error(f"生成同义词关系失败: {e}")
        return 0


def _generate_antonym_relations():
    """生成反义词关系"""
    from web_app.services.relations.antonym_generator import generate_antonym_relations
    try:
        return generate_antonym_relations()
    except Exception as e:
        logging.error(f"生成反义词关系失败: {e}")
        return 0


def _generate_root_relations():
    """生成词根关系"""
    from web_app.services.relations.root_generator import generate_root_relations
    try:
        return generate_root_relations()
    except Exception as e:
        logging.error(f"生成词根关系失败: {e}")
        return 0


def _generate_confused_relations():
    """生成易混淆词关系"""
    from web_app.services.relations.confused_generator import generate_confused_relations
    try:
        return generate_confused_relations()
    except Exception as e:
        logging.error(f"生成易混淆词关系失败: {e}")
        return 0


def _generate_topic_relations():
    """生成主题关系"""
    from web_app.services.relations.topic_generator import generate_topic_relations
    try:
        return generate_topic_relations()
    except Exception as e:
        logging.error(f"生成主题关系失败: {e}")
        return 0
