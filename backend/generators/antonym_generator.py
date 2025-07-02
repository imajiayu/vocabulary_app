# -*- coding: utf-8 -*-
"""
反义词关系生成器

使用三种方法识别反义词：
1. WordNet 反义词（最高优先级）
2. 手工定义的反义词对
3. 形态学判断（否定前缀）
"""
from typing import Callable, Dict, Optional, Set, List, Tuple
from threading import Event

from .base import BaseGenerator, GenerationResult
from .data import antonym_manual_pairs, antonym_false_paris

try:
    from nltk.corpus import wordnet
    NLTK_AVAILABLE = True
except ImportError:
    NLTK_AVAILABLE = False


class AntonymGenerator(BaseGenerator):
    """反义词关系生成器"""

    relation_type = "antonym"

    def __init__(
        self,
        on_progress: Optional[Callable[[int, int, int], None]] = None,
        stop_event: Optional[Event] = None,
        on_save: Optional[Callable] = None,
    ):
        super().__init__(on_progress=on_progress, stop_event=stop_event, on_save=on_save)
        self.manual_antonyms = self._build_manual_antonyms()
        self.false_prefix_pairs = self._build_false_prefix_pairs()

    def _build_false_prefix_pairs(self) -> Set[Tuple[str, str]]:
        """构建不应该作为反义词的前缀词对"""
        false_pairs = antonym_false_paris
        return false_pairs | {(w2, w1) for w1, w2 in false_pairs}

    def _build_manual_antonyms(self) -> Dict[str, Set[str]]:
        """构建手工反义词字典"""
        manual_dict = {}
        for word1, word2 in antonym_manual_pairs:
            if word1 not in manual_dict:
                manual_dict[word1] = set()
            if word2 not in manual_dict:
                manual_dict[word2] = set()
            manual_dict[word1].add(word2)
            manual_dict[word2].add(word1)
        return manual_dict

    def _get_wordnet_antonyms(self, word: str) -> Set[str]:
        """获取 WordNet 反义词"""
        if not NLTK_AVAILABLE:
            return set()

        antonyms = set()
        word_lower = word.lower()

        for synset in wordnet.synsets(word_lower):
            for lemma in synset.lemmas():
                for antonym in lemma.antonyms():
                    ant_word = antonym.name().replace("_", " ").lower()
                    if ant_word != word_lower:
                        antonyms.add(ant_word)

        return antonyms

    def _get_manual_antonyms(self, word: str) -> Set[str]:
        """获取手工定义的反义词"""
        return self.manual_antonyms.get(word.lower(), set())

    def _get_morphological_antonyms(self, word: str, word_index: Dict[str, int]) -> Set[str]:
        """通过词缀识别反义词"""
        antonyms = set()
        word_lower = word.lower()

        negative_prefixes = ["un", "dis", "in", "im", "ir", "il", "non"]

        for prefix in negative_prefixes:
            if word_lower.startswith(prefix) and len(word_lower) > len(prefix) + 2:
                base_word = word_lower[len(prefix):]

                if (
                    base_word in word_index
                    and len(base_word) >= 3
                    and (word_lower, base_word) not in self.false_prefix_pairs
                ):
                    antonyms.add(base_word)

        return antonyms

    def _calculate_confidence(self, source: str) -> float:
        """计算反义词置信度"""
        confidence_map = {
            "wordnet": 1.0,
            "manual": 0.95,
            "morphological": 0.85
        }
        return confidence_map.get(source, 0.7)

    def generate(
        self,
        words: List[Dict],
        word_index: Dict[str, int],
        existing_relations: Set[Tuple[int, int, str]],
        processed_word_ids: Set[int]
    ) -> GenerationResult:
        """生成反义词关系"""

        unprocessed = [w for w in words if w['id'] not in processed_word_ids]

        if not unprocessed:
            return GenerationResult(relations=[], logs=[], stats={'skipped': True})

        stats_by_source = {'wordnet': 0, 'manual': 0, 'morphological': 0}
        skipped_existing = 0

        for i, word_data in enumerate(unprocessed):
            if self._is_stopped():
                break

            word = word_data['word']
            word_id = word_data['id']
            found_count = 0

            all_antonyms = {}

            # 1. WordNet 反义词（最高优先级）
            wordnet_antonyms = self._get_wordnet_antonyms(word)
            for ant in wordnet_antonyms:
                all_antonyms[ant] = "wordnet"

            # 2. 手工反义词（第二优先级）
            manual_antonyms = self._get_manual_antonyms(word)
            for ant in manual_antonyms:
                if ant not in all_antonyms:
                    all_antonyms[ant] = "manual"

            # 3. 形态学反义词（仅当前两种方法找不到时）
            if not all_antonyms:
                morphological_antonyms = self._get_morphological_antonyms(word, word_index)
                for ant in morphological_antonyms:
                    all_antonyms[ant] = "morphological"

            # 创建关系
            for ant_word, source in all_antonyms.items():
                if ant_word in word_index:
                    related_id = word_index[ant_word]
                    confidence = self._calculate_confidence(source)

                    if self._add_relation(word_id, related_id, confidence, existing_relations):
                        found_count += 1
                        stats_by_source[source] += 1
                    else:
                        skipped_existing += 1

            self._add_log(word_id, found_count)
            self._flush()
            self._report_progress(i + 1, len(unprocessed), sum(stats_by_source.values()))

        # 刷入剩余缓冲区
        self._flush(force=True)

        total_found = sum(stats_by_source.values())

        stats = {
            'total_found': total_found,
            'skipped_existing': skipped_existing,
            'by_source': stats_by_source,
            'processed_count': len(unprocessed)
        }

        return GenerationResult(relations=[], logs=[], stats=stats)
