# -*- coding: utf-8 -*-
"""
主题关系生成器

基于 IELTS 预定义主题分类，将词汇聚合到对应的主题 cluster 中。
"""
from typing import Callable, Dict, List, Optional, Set, Tuple
from threading import Event

from .base import BaseGenerator, GenerationResult
from .data import IELTS_TOPICS


class TopicGenerator(BaseGenerator):
    """IELTS 主题关系生成器"""

    relation_type = "topic"

    def __init__(
        self,
        on_progress: Optional[Callable[[int, int, int], None]] = None,
        stop_event: Optional[Event] = None,
        on_save: Optional[Callable] = None,
    ):
        super().__init__(on_progress=on_progress, stop_event=stop_event, on_save=on_save)
        self.topic_words = IELTS_TOPICS
        self.word_to_topics = self._build_word_index()

    def _build_word_index(self) -> Dict[str, Set[str]]:
        """构建单词到主题的反向索引"""
        word_index = {}
        for topic, words in self.topic_words.items():
            for word in words:
                word_lower = word.lower()
                if word_lower not in word_index:
                    word_index[word_lower] = set()
                word_index[word_lower].add(topic)
        return word_index

    def generate(
        self,
        words: List[Dict],
        word_index: Dict[str, int],
        existing_relations: Set[Tuple[int, int, str]],
        processed_word_ids: Set[int]
    ) -> GenerationResult:
        """生成主题关系"""

        unprocessed = [w for w in words if w['id'] not in processed_word_ids]

        if not self.topic_words:
            return GenerationResult(relations=[], logs=[], stats={'error': 'no topic data'})

        ielts_words = [w for w in unprocessed if w['word'].lower() in self.word_to_topics]

        if not ielts_words:
            return GenerationResult(relations=[], logs=[], stats={'skipped': True})

        total_found = 0
        skipped_existing = 0
        processed_pairs: Set[Tuple[int, int]] = set()
        stats_by_topic: Dict[str, int] = {}
        word_found_counts: Dict[int, int] = {}

        word_map = {w['word'].lower(): w for w in words}
        unprocessed_ids = {w['id'] for w in unprocessed}

        # 预计算每个未处理词还剩多少主题需要处理
        # 当一个词的所有主题都处理完后，立即添加其 log（与 relations 同步 flush）
        remaining_topics: Dict[int, Set[str]] = {}
        for w in unprocessed:
            word_lower = w['word'].lower()
            if word_lower in self.word_to_topics:
                remaining_topics[w['id']] = self.word_to_topics[word_lower].copy()

        for topic_idx, (topic, topic_word_list) in enumerate(self.topic_words.items()):
            if self._is_stopped():
                break

            topic_found = 0

            # 包含所有匹配的词（含已处理），确保新词能和旧词形成关系
            words_in_topic = []
            for word_str in topic_word_list:
                word_lower = word_str.lower()
                if word_lower in word_map:
                    words_in_topic.append(word_map[word_lower])

            for i in range(len(words_in_topic)):
                for j in range(i + 1, len(words_in_topic)):
                    w1 = words_in_topic[i]
                    w2 = words_in_topic[j]

                    # 跳过双方都已处理过的词对
                    if w1['id'] not in unprocessed_ids and w2['id'] not in unprocessed_ids:
                        continue

                    pair_key = tuple(sorted([w1['id'], w2['id']]))
                    if pair_key in processed_pairs:
                        continue
                    processed_pairs.add(pair_key)

                    if self._add_relation(w1['id'], w2['id'], 1.0, existing_relations):
                        topic_found += 1
                        total_found += 1
                        word_found_counts[w1['id']] = word_found_counts.get(w1['id'], 0) + 1
                        word_found_counts[w2['id']] = word_found_counts.get(w2['id'], 0) + 1
                    else:
                        skipped_existing += 1

            if topic_found > 0:
                stats_by_topic[topic] = topic_found

            # 检查哪些词的所有主题都已处理完，添加其 log
            for w in words_in_topic:
                wid = w['id']
                if wid in remaining_topics:
                    remaining_topics[wid].discard(topic)
                    if len(remaining_topics[wid]) == 0:
                        self._add_log(wid, word_found_counts.get(wid, 0))
                        del remaining_topics[wid]

            self._flush()
            self._report_progress(topic_idx + 1, len(self.topic_words), total_found)

        # 刷入剩余缓冲区
        self._flush(force=True)

        stats = {
            'total_found': total_found,
            'skipped_existing': skipped_existing,
            'by_topic': stats_by_topic,
            'processed_count': len(unprocessed)
        }

        return GenerationResult(relations=[], logs=[], stats=stats)
