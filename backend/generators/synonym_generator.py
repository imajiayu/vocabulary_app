# -*- coding: utf-8 -*-
"""
同义词关系生成器

使用 WordNet 直接同义词 + 语义相似度两种方法找同义词。
"""
from typing import Callable, Dict, List, Optional, Set, Tuple
from functools import lru_cache
from concurrent.futures import ProcessPoolExecutor
from threading import Event
import os

from .base import BaseGenerator, GenerationResult

try:
    from nltk.corpus import wordnet
    NLTK_AVAILABLE = True
except ImportError:
    NLTK_AVAILABLE = False


@lru_cache(maxsize=10000)
def _get_synsets(word: str):
    """缓存 WordNet synsets 查询"""
    if not NLTK_AVAILABLE:
        return []
    return wordnet.synsets(word.lower())


def _compute_similarity_batch(args):
    """
    计算一批词对的语义相似度（用于并行处理）

    为了支持多进程，传递 word 字符串而非 synset 对象
    """
    batch_indices, words_data, threshold = args
    batch_results = {}

    for i in batch_indices:
        w1 = words_data[i]
        w1_synsets = wordnet.synsets(w1['word'].lower())[:2]

        for j in range(i + 1, len(words_data)):
            w2 = words_data[j]
            w2_synsets = wordnet.synsets(w2['word'].lower())[:2]

            max_similarity = 0
            for s1 in w1_synsets:
                for s2 in w2_synsets:
                    sim = s1.path_similarity(s2)
                    if sim and sim > max_similarity:
                        max_similarity = sim
                        if sim >= threshold:
                            break
                if max_similarity >= threshold:
                    break

            if max_similarity >= threshold:
                batch_results[(w1['id'], w2['id'])] = max_similarity

    return batch_results


class SynonymGenerator(BaseGenerator):
    """同义词关系生成器"""

    relation_type = "synonym"

    def __init__(
        self,
        on_progress: Optional[Callable[[int, int, int], None]] = None,
        stop_event: Optional[Event] = None,
        on_save: Optional[Callable] = None,
        min_confidence: float = 0.6,
        semantic_threshold: float = 0.8,
    ):
        super().__init__(on_progress=on_progress, stop_event=stop_event, on_save=on_save)
        self.min_confidence = min_confidence
        self.semantic_threshold = semantic_threshold

    def _calculate_confidence(self, synset, lemma) -> float:
        """计算 WordNet 同义词的置信度"""
        base_confidence = 0.9

        if hasattr(lemma, "count") and lemma.count() > 0:
            freq_bonus = min(0.1, lemma.count() / 100)
            base_confidence += freq_bonus

        if hasattr(synset, "definition") and synset.definition():
            def_bonus = min(0.05, len(synset.definition().split()) / 50)
            base_confidence += def_bonus

        return min(1.0, base_confidence)

    def _get_wordnet_synonyms(self, word: str) -> Dict[str, float]:
        """获取 WordNet 直接同义词"""
        synonyms = {}
        word_lower = word.lower()

        synsets = _get_synsets(word_lower)
        if not synsets:
            return synonyms

        for synset in synsets:
            for lemma in synset.lemmas():
                syn_word = lemma.name().replace("_", " ").lower()
                if syn_word != word_lower and len(syn_word) > 1:
                    confidence = self._calculate_confidence(synset, lemma)
                    if syn_word in synonyms:
                        synonyms[syn_word] = max(synonyms[syn_word], confidence)
                    else:
                        synonyms[syn_word] = confidence

        return {k: v for k, v in synonyms.items() if v >= self.min_confidence}

    def _compute_semantic_similarities(
        self,
        words: List[Dict],
    ) -> Dict[Tuple[int, int], float]:
        """使用并行计算语义相似度"""
        words_with_synsets = [w for w in words if _get_synsets(w['word'])]
        total = len(words_with_synsets)

        if total == 0:
            return {}

        similar_pairs = {}

        n_workers = min(os.cpu_count() or 4, 8)
        batch_size = 100
        batches = []

        for i in range(0, total, batch_size):
            batch_indices = list(range(i, min(i + batch_size, total)))
            batches.append((batch_indices, words_with_synsets, self.semantic_threshold))

        with ProcessPoolExecutor(max_workers=n_workers) as executor:
            results = list(executor.map(_compute_similarity_batch, batches))

        for batch_result in results:
            similar_pairs.update(batch_result)

        return similar_pairs

    def generate(
        self,
        words: List[Dict],
        word_index: Dict[str, int],
        existing_relations: Set[Tuple[int, int, str]],
        processed_word_ids: Set[int]
    ) -> GenerationResult:
        """生成同义词关系"""

        if not NLTK_AVAILABLE:
            return GenerationResult(relations=[], logs=[], stats={'error': 'nltk not available'})

        unprocessed = [w for w in words if w['id'] not in processed_word_ids]

        if not unprocessed:
            return GenerationResult(relations=[], logs=[], stats={'skipped': True})

        total_found = 0
        skipped_existing = 0

        # Phase 1: WordNet 直接同义词
        for i, word_data in enumerate(unprocessed):
            if self._is_stopped():
                break

            word = word_data['word']
            word_id = word_data['id']
            found_count = 0

            synonyms = self._get_wordnet_synonyms(word)

            for syn_word, confidence in synonyms.items():
                if syn_word in word_index:
                    related_id = word_index[syn_word]
                    if self._add_relation(word_id, related_id, confidence, existing_relations):
                        found_count += 1
                        total_found += 1
                    else:
                        skipped_existing += 1

            self._add_log(word_id, found_count)
            self._flush()
            self._report_progress(i + 1, len(unprocessed), total_found)

        # Phase 2: 语义相似度（如果未停止）
        semantic_found = 0
        if not self._is_stopped():
            semantic_pairs = self._compute_semantic_similarities(unprocessed)

            for (w1_id, w2_id), confidence in semantic_pairs.items():
                if self._add_relation(w1_id, w2_id, confidence, existing_relations):
                    semantic_found += 1
                    total_found += 1
                else:
                    skipped_existing += 1

        # 刷入剩余缓冲区
        self._flush(force=True)

        stats = {
            'total_found': total_found,
            'skipped_existing': skipped_existing,
            'wordnet_found': total_found - semantic_found,
            'semantic_found': semantic_found,
            'processed_count': len(unprocessed)
        }

        return GenerationResult(relations=[], logs=[], stats=stats)
