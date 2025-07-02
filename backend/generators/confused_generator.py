# -*- coding: utf-8 -*-
"""
易混淆词关系生成器

识别形似义不同的词对（如 angel/angle, affect/effect）。
"""
from difflib import SequenceMatcher
from typing import Callable, Dict, Optional, Set, Tuple, List
from threading import Event

from .base import BaseGenerator, GenerationResult
from .data import confused_pairs

try:
    from nltk.corpus import wordnet
    NLTK_AVAILABLE = True
except ImportError:
    NLTK_AVAILABLE = False


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


class ConfusedGenerator(BaseGenerator):
    """易混淆词关系生成器"""

    relation_type = "confused"

    def __init__(
        self,
        on_progress: Optional[Callable[[int, int, int], None]] = None,
        stop_event: Optional[Event] = None,
        on_save: Optional[Callable] = None,
        min_length: int = 5,
    ):
        super().__init__(on_progress=on_progress, stop_event=stop_event, on_save=on_save)
        self.min_length = min_length
        self.classic_confused_pairs = self._build_classic_pairs()

    def _build_classic_pairs(self) -> Set[Tuple[str, str]]:
        """构建经典易混淆词对"""
        pair_set = set()
        for w1, w2 in confused_pairs:
            pair_set.add((w1.lower(), w2.lower()))
            pair_set.add((w2.lower(), w1.lower()))
        return pair_set

    def are_semantically_different(self, word1: str, word2: str) -> bool:
        """检查两个词在语义上是否不同"""
        if not NLTK_AVAILABLE:
            return True

        synsets1 = set(wordnet.synsets(word1.lower()))
        synsets2 = set(wordnet.synsets(word2.lower()))

        if not synsets1 or not synsets2:
            return False

        if synsets1 & synsets2:
            return False

        max_similarity = 0
        for s1 in synsets1:
            for s2 in synsets2:
                sim = s1.path_similarity(s2)
                if sim and sim > max_similarity:
                    max_similarity = sim

        return max_similarity < 0.25

    def _is_letter_order_difference(self, w1: str, w2: str) -> bool:
        """检查是否是字母顺序差异（如 angel/angle）"""
        return sorted(w1) == sorted(w2) and w1 != w2

    def calculate_confusion_score(self, word1: str, word2: str) -> Tuple[bool, float]:
        """计算易混淆分数"""
        w1, w2 = word1.lower(), word2.lower()

        if (w1, w2) in self.classic_confused_pairs:
            return True, 0.95

        edit_dist = levenshtein_distance(w1, w2)
        if edit_dist > 2:
            return False, 0.0

        similarity = SequenceMatcher(None, w1, w2).ratio()

        if edit_dist == 1:
            min_similarity = 0.75
        elif edit_dist == 2:
            min_similarity = 0.70
        else:
            min_similarity = 0.65

        if similarity < min_similarity:
            return False, 0.0

        if not self.are_semantically_different(w1, w2):
            return False, 0.0

        base_score = 1.0 - (edit_dist * 0.1)
        bonus_score = 0

        if edit_dist == 1:
            bonus_score += 0.05

        if self._is_letter_order_difference(w1, w2):
            bonus_score += 0.05

        return True, min(1.0, base_score + bonus_score)

    def generate(
        self,
        words: List[Dict],
        word_index: Dict[str, int],
        existing_relations: Set[Tuple[int, int, str]],
        processed_word_ids: Set[int]
    ) -> GenerationResult:
        """生成易混淆词关系"""

        unprocessed = [
            w for w in words
            if w['id'] not in processed_word_ids and len(w['word']) >= self.min_length
        ]

        if not unprocessed:
            return GenerationResult(relations=[], logs=[], stats={'skipped': True})

        # 所有满足长度要求的词作为候选（含已处理），确保新词能和旧词比较
        all_candidates = [w for w in words if len(w['word']) >= self.min_length]

        total_found = 0
        skipped_existing = 0
        stats_by_type = {'classic': 0, 'computed': 0}

        for i, w1 in enumerate(unprocessed):
            if self._is_stopped():
                break

            found_count = 0

            for w2 in all_candidates:
                if w1['id'] >= w2['id']:
                    continue

                is_confused, score = self.calculate_confusion_score(w1['word'], w2['word'])

                if is_confused:
                    if self._add_relation(w1['id'], w2['id'], score, existing_relations):
                        found_count += 1
                        total_found += 1
                        if (w1['word'].lower(), w2['word'].lower()) in self.classic_confused_pairs:
                            stats_by_type['classic'] += 1
                        else:
                            stats_by_type['computed'] += 1
                    else:
                        skipped_existing += 1

            self._add_log(w1['id'], found_count)
            self._flush()
            self._report_progress(i + 1, len(unprocessed), total_found)

        # 刷入剩余缓冲区
        self._flush(force=True)

        stats = {
            'total_found': total_found,
            'skipped_existing': skipped_existing,
            'by_type': stats_by_type,
            'processed_count': len(unprocessed)
        }

        return GenerationResult(relations=[], logs=[], stats=stats)
