# -*- coding: utf-8 -*-
"""
单词关系生成模块

包含5种关系生成器：
- SynonymGenerator: 同义词（基于 WordNet）
- AntonymGenerator: 反义词（基于 WordNet + 手工定义）
- RootGenerator: 词根关系（拉丁/希腊词根 + 词干分析）
- ConfusedGenerator: 易混淆词（编辑距离 + 语义检查）
- TopicGenerator: 主题关系（IELTS 预定义主题）
"""

from .base import BaseGenerator, GenerationResult
from .synonym_generator import SynonymGenerator
from .antonym_generator import AntonymGenerator
from .root_generator import RootGenerator
from .confused_generator import ConfusedGenerator
from .topic_generator import TopicGenerator

__all__ = [
    'BaseGenerator',
    'GenerationResult',
    'SynonymGenerator',
    'AntonymGenerator',
    'RootGenerator',
    'ConfusedGenerator',
    'TopicGenerator',
]
