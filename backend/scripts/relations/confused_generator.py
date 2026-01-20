# -*- coding: utf-8 -*-
"""
易混淆词关系生成器

识别形似义不同的词对（如 angel/angle, affect/effect）。
"""
from difflib import SequenceMatcher
from typing import Dict, Set, Tuple, List

from .base import BaseGenerator, GenerationResult, ProgressPrinter, print_section, print_stat
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

    def __init__(self, min_length: int = 5):
        super().__init__()
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
            return True  # 没有 WordNet 时默认通过

        synsets1 = set(wordnet.synsets(word1.lower()))
        synsets2 = set(wordnet.synsets(word2.lower()))

        # 两个词都必须在 WordNet 中
        if not synsets1 or not synsets2:
            return False

        # 检查是否有共同的 synset（同义词）
        if synsets1 & synsets2:
            return False

        # 检查语义相似度
        max_similarity = 0
        for s1 in synsets1:
            for s2 in synsets2:
                sim = s1.path_similarity(s2)
                if sim and sim > max_similarity:
                    max_similarity = sim

        # 语义相似度必须 < 0.25
        return max_similarity < 0.25

    def _is_letter_order_difference(self, w1: str, w2: str) -> bool:
        """检查是否是字母顺序差异（如 angel/angle）"""
        return sorted(w1) == sorted(w2) and w1 != w2

    def calculate_confusion_score(self, word1: str, word2: str) -> Tuple[bool, float]:
        """计算易混淆分数"""
        w1, w2 = word1.lower(), word2.lower()

        # 经典易混淆对优先通过
        if (w1, w2) in self.classic_confused_pairs:
            return True, 0.95

        # 计算编辑距离（必须 <= 2）
        edit_dist = levenshtein_distance(w1, w2)
        if edit_dist > 2:
            return False, 0.0

        # 计算字符串相似度
        similarity = SequenceMatcher(None, w1, w2).ratio()

        # 相似度要求
        if edit_dist == 1:
            min_similarity = 0.75
        elif edit_dist == 2:
            min_similarity = 0.70
        else:
            min_similarity = 0.65

        if similarity < min_similarity:
            return False, 0.0

        # 语义检查：必须语义不同
        if not self.are_semantically_different(w1, w2):
            return False, 0.0

        # 计算分数
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

        if not NLTK_AVAILABLE:
            print("   ⚠️  警告: nltk 未安装，语义检查将跳过")

        # 过滤：未处理 + 长度足够
        unprocessed = [
            w for w in words
            if w['id'] not in processed_word_ids and len(w['word']) >= self.min_length
        ]

        print_section(f"易混淆词生成 (confused)")
        print_stat("总单词数", len(words))
        print_stat("待处理", len(unprocessed))
        print_stat("最小长度", self.min_length)
        print_stat("经典词对数", len(confused_pairs))

        if not unprocessed:
            print("\n   ✓ 所有单词已处理完毕")
            return GenerationResult(relations=[], logs=[], stats={'skipped': True})

        new_relations = []
        new_logs = []
        total_found = 0
        skipped_existing = 0
        stats_by_type = {'classic': 0, 'computed': 0}

        # 比较词对
        print(f"\n   🔍 比较词对...")
        total_comparisons = len(unprocessed) * (len(unprocessed) - 1) // 2
        progress = ProgressPrinter(len(unprocessed))

        for i, w1 in enumerate(unprocessed):
            found_count = 0

            for j in range(i + 1, len(unprocessed)):
                w2 = unprocessed[j]

                is_confused, score = self.calculate_confusion_score(w1['word'], w2['word'])

                if is_confused:
                    if self._add_relation(w1['id'], w2['id'], score, new_relations, existing_relations):
                        found_count += 1
                        total_found += 1
                        # 统计类型
                        if (w1['word'].lower(), w2['word'].lower()) in self.classic_confused_pairs:
                            stats_by_type['classic'] += 1
                        else:
                            stats_by_type['computed'] += 1
                    else:
                        skipped_existing += 1

            new_logs.append(self._create_log(w1['id'], found_count))
            progress.update(i + 1, f"{w1['word']}: +{found_count}")

        progress.finish(f"找到 {total_found} 对易混淆词")

        # 统计
        stats = {
            'total_found': total_found,
            'skipped_existing': skipped_existing,
            'by_type': stats_by_type,
            'processed_count': len(unprocessed)
        }

        print(f"\n   ✅ 易混淆词生成完成")
        print_stat("新增关系", f"{len(new_relations)} 条（双向）")
        print_stat("经典词对", stats_by_type['classic'])
        print_stat("计算发现", stats_by_type['computed'])
        print_stat("跳过已存在", skipped_existing)

        return GenerationResult(relations=new_relations, logs=new_logs, stats=stats)
