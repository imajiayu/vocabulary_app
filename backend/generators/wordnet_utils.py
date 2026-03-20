# -*- coding: utf-8 -*-
"""
WordNet 共享工具 — 统一缓存，供 synonym/topic 等生成器复用
"""
from functools import lru_cache

try:
    from nltk.corpus import wordnet
    NLTK_AVAILABLE = True
except ImportError:
    NLTK_AVAILABLE = False


@lru_cache(maxsize=10000)
def get_synsets(word: str):
    """
    缓存 WordNet synsets 查询，返回所有义项。

    调用方按需切片（如 topic 生成器只取 [:1]）。
    统一缓存避免多个生成器各维护独立缓存。
    """
    if not NLTK_AVAILABLE:
        return ()
    return tuple(wordnet.synsets(word.lower()))
