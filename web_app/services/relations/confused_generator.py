# -*- coding: utf-8 -*-
from difflib import SequenceMatcher
from typing import Dict, Set, Tuple, List
from nltk.corpus import wordnet
from web_app.models.word import WordRelation, RelationType
from web_app.database.relation_dao import db_get_all_words, db_batch_insert_relations
from .data import confused_pairs


def _save_relations(relations: List[WordRelation]):
    """将 WordRelation 对象列表保存到数据库"""
    if not relations:
        return

    relations_data = [
        {
            'word_id': rel.word_id,
            'related_word_id': rel.related_word_id,
            'relation_type': rel.relation_type,
            'confidence': rel.confidence
        }
        for rel in relations
    ]
    db_batch_insert_relations(relations_data)


def levenshtein_distance(s1: str, s2: str) -> int:
    """计算编辑距离（Levenshtein距离）"""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


class ConfusedWordsGenerator:
    """易混淆词生成器 - 专注于形似义不同的词对"""

    def __init__(self, min_length: int = 5):
        """
        初始化易混淆词生成器

        参数:
        - min_length: 最小单词长度（默认5，避免短词产生太多噪音）
        """
        self.min_length = min_length
        self.processed_pairs = set()
        # 经典易混淆词对
        self.classic_confused_pairs = self._build_classic_pairs()

    def _build_classic_pairs(self) -> Set[Tuple[str, str]]:
        """构建经典易混淆词对"""
        pairs = confused_pairs

        # 转换为集合，同时添加反向对
        pair_set = set()
        for w1, w2 in pairs:
            pair_set.add((w1.lower(), w2.lower()))
            pair_set.add((w2.lower(), w1.lower()))

        return pair_set

    def are_semantically_different(self, word1: str, word2: str) -> bool:
        """
        检查两个词在语义上是否不同（避免同义词被标记为易混淆）

        更严格的语义检查：
        1. 两个词都必须在WordNet中有定义
        2. 不能有共同的synset
        3. 语义相似度必须很低（< 0.25）
        """
        synsets1 = set(wordnet.synsets(word1.lower()))
        synsets2 = set(wordnet.synsets(word2.lower()))

        # 更严格：两个词都必须在WordNet中，否则拒绝
        if not synsets1 or not synsets2:
            return False  # 如果任一词没有WordNet条目，拒绝（更安全）

        # 检查是否有共同的synset（同义词）
        if synsets1 & synsets2:
            return False

        # 检查语义相似度（更严格的阈值）
        max_similarity = 0
        for s1 in synsets1:
            for s2 in synsets2:
                sim = s1.path_similarity(s2)
                if sim and sim > max_similarity:
                    max_similarity = sim

        # 更严格：语义相似度必须 < 0.25（之前是0.3）
        return max_similarity < 0.25

    def calculate_confusion_score(self, word1: str, word2: str) -> Tuple[bool, float]:
        """
        计算易混淆分数（基于编辑距离和相似度）

        更严格的筛选条件（2024优化版）：
        1. 编辑距离 ≤ 2
        2. 字符串相似度更高的阈值（75%/70%）
        3. 必须通过严格的语义检查
        4. 经典易混淆对优先通过
        """
        w1, w2 = word1.lower(), word2.lower()

        # 检查是否是经典易混淆对（优先级最高，直接通过）
        if (w1, w2) in self.classic_confused_pairs:
            return True, 0.95

        # 计算编辑距离
        edit_dist = levenshtein_distance(w1, w2)

        # 编辑距离必须 <= 2（1-2个字符差异）
        if edit_dist > 2:
            return False, 0.0

        # 计算字符串相似度
        similarity = SequenceMatcher(None, w1, w2).ratio()

        # 更严格的相似度要求（提高5%）
        if edit_dist == 1:
            min_similarity = 0.75  # 距离1：相似度 >= 75%（之前是70%）
        elif edit_dist == 2:
            min_similarity = 0.70  # 距离2：相似度 >= 70%（之前是65%）
        else:
            min_similarity = 0.65  # 理论上不会到这里

        if similarity < min_similarity:
            return False, 0.0

        # 语义检查：必须语义不同才算易混淆（更严格）
        if not self.are_semantically_different(w1, w2):
            return False, 0.0

        # 根据编辑距离计算基础分数
        # 编辑距离 1 = 0.9, 编辑距离 2 = 0.8
        base_score = 1.0 - (edit_dist * 0.1)

        # 特殊模式加分
        bonus_score = 0

        # 1. 单字母差异（最容易混淆）
        if edit_dist == 1:
            bonus_score += 0.05

        # 2. 字母顺序差异（如 angel/angle）
        if self._is_letter_order_difference(w1, w2):
            bonus_score += 0.05

        final_score = min(1.0, base_score + bonus_score)

        # 返回结果
        return True, final_score

    def _is_single_letter_difference(self, w1: str, w2: str) -> bool:
        """检查是否只有一个字母不同"""
        if len(w1) != len(w2):
            return False

        diff_count = sum(c1 != c2 for c1, c2 in zip(w1, w2))
        return diff_count == 1

    def _is_letter_order_difference(self, w1: str, w2: str) -> bool:
        """检查是否是字母顺序差异（如 angel/angle）"""
        return sorted(w1) == sorted(w2) and w1 != w2

    def _is_double_letter_difference(self, w1: str, w2: str) -> bool:
        """检查是否是双字母差异"""
        if len(w1) != len(w2):
            return False

        diff_count = sum(c1 != c2 for c1, c2 in zip(w1, w2))
        return diff_count == 2

    def _has_prefix_suffix_confusion(self, w1: str, w2: str) -> bool:
        """检查前缀后缀混淆"""
        common_confusions = [
            ("in", "un"),
            ("dis", "mis"),
            ("pre", "pro"),
            ("able", "ible"),
            ("ance", "ence"),
            ("tion", "sion"),
        ]

        for prefix1, prefix2 in common_confusions:
            if (
                w1.startswith(prefix1)
                and w2.startswith(prefix2)
                and w1[len(prefix1) :] == w2[len(prefix2) :]
            ):
                return True
            if (
                w1.endswith(prefix1)
                and w2.endswith(prefix2)
                and w1[: -len(prefix1)] == w2[: -len(prefix2)]
            ):
                return True

        return False

    def generate_relations(self, emitter=None) -> int:
        """生成易混淆词关系"""
        words_data = db_get_all_words()
        # 过滤掉太短的词
        words_data = [w for w in words_data if len(w["word"]) >= self.min_length]

        relations_to_add = []
        total_found = 0
        total = len(words_data)

        if emitter:
            emitter.emit_progress(0, total, "Starting confused words generation...")

        for i, w1 in enumerate(words_data):
            if emitter and i % 100 == 0:
                emitter.emit_progress(
                    i,
                    total,
                    f"Processing confused words: {i}/{total} words, {total_found} found",
                )

            for j in range(i + 1, len(words_data)):
                w2 = words_data[j]

                is_confused, score = self.calculate_confusion_score(
                    w1["word"], w2["word"]
                )

                if is_confused:
                    pair_key = (w1["id"], w2["id"])
                    if pair_key not in self.processed_pairs:
                        self.processed_pairs.add(pair_key)
                        total_found += 1

                        relations_to_add.append(
                            WordRelation(
                                word_id=w1["id"],
                                related_word_id=w2["id"],
                                relation_type=RelationType.confused,
                                confidence=score,
                            )
                        )

                # 批量插入
                if len(relations_to_add) >= 1000:
                    _save_relations(relations_to_add)
                    relations_to_add = []

        # 处理剩余关系
        _save_relations(relations_to_add)

        return total_found


def generate_confused_relations(
    min_length: int = 5, similarity_threshold: float = 0.75
):
    """
    生成易混淆关系的入口函数

    参数:
    - min_length: 最小单词长度（默认5，更严格）
    - similarity_threshold: 相似度阈值（已弃用，保留用于向后兼容）
    """
    generator = ConfusedWordsGenerator(min_length=min_length)
    return generator.generate_relations()
