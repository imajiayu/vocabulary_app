# -*- coding: utf-8 -*-
"""
单词关系生成模块
"""

from backend.services.relations.synonym_generator import generate_synonym_relations
from backend.services.relations.antonym_generator import generate_antonym_relations
from backend.services.relations.root_generator import generate_root_relations
from backend.services.relations.confused_generator import generate_confused_relations
from backend.services.relations.topic_generator import generate_topic_relations

__all__ = [
    'generate_synonym_relations',
    'generate_antonym_relations',
    'generate_root_relations',
    'generate_confused_relations',
    'generate_topic_relations',
]
