# -*- coding: utf-8 -*-
"""
主题关系生成器

基于 IELTS 预定义主题分类，将词汇聚合到对应的主题 cluster 中。
"""
import json
import os
from typing import Dict, List, Set, Tuple

from .base import BaseGenerator, GenerationResult, ProgressPrinter, print_section, print_stat


class TopicGenerator(BaseGenerator):
    """IELTS 主题关系生成器"""

    relation_type = "topic"

    def __init__(self):
        super().__init__()
        self.topic_words = self._load_ielts_topics()
        self.word_to_topics = self._build_word_index()

    def _load_ielts_topics(self) -> Dict[str, List[str]]:
        """加载 IELTS 主题词汇数据"""
        # 相对于当前文件的路径
        data_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            'data'
        )
        json_path = os.path.join(data_dir, 'ielts_topics.json')

        if not os.path.exists(json_path):
            print(f"   ⚠️  警告: 主题数据文件不存在: {json_path}")
            return {}

        with open(json_path, 'r', encoding='utf-8') as f:
            return json.load(f)

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

        # 过滤未处理的单词
        unprocessed = [w for w in words if w['id'] not in processed_word_ids]

        # 统计在 IELTS 词库中的单词
        ielts_words = [w for w in unprocessed if w['word'].lower() in self.word_to_topics]

        print_section(f"主题关系生成 (topic)")
        print_stat("总单词数", len(words))
        print_stat("待处理", len(unprocessed))
        print_stat("IELTS词库匹配", len(ielts_words))
        print_stat("主题数", len(self.topic_words))

        if not self.topic_words:
            print("\n   ❌ 主题数据未加载")
            return GenerationResult(relations=[], logs=[], stats={'error': 'no topic data'})

        if not ielts_words:
            print("\n   ✓ 所有单词已处理完毕")
            return GenerationResult(relations=[], logs=[], stats={'skipped': True})

        new_relations = []
        new_logs = []
        total_found = 0
        skipped_existing = 0
        processed_pairs: Set[Tuple[int, int]] = set()
        stats_by_topic: Dict[str, int] = {}

        # 构建单词映射
        word_map = {w['word'].lower(): w for w in words}
        unprocessed_ids = {w['id'] for w in unprocessed}

        print(f"\n   🏷️  按主题生成关系...")
        progress = ProgressPrinter(len(self.topic_words))

        for topic_idx, (topic, topic_word_list) in enumerate(self.topic_words.items()):
            topic_found = 0

            # 找出该主题下在词库中且未处理的单词
            words_in_topic = []
            for word_str in topic_word_list:
                word_lower = word_str.lower()
                if word_lower in word_map:
                    word_obj = word_map[word_lower]
                    if word_obj['id'] in unprocessed_ids:
                        words_in_topic.append(word_obj)

            # 为该主题内的所有词对建立关系
            for i in range(len(words_in_topic)):
                for j in range(i + 1, len(words_in_topic)):
                    w1 = words_in_topic[i]
                    w2 = words_in_topic[j]

                    # 去重
                    pair_key = tuple(sorted([w1['id'], w2['id']]))
                    if pair_key in processed_pairs:
                        continue
                    processed_pairs.add(pair_key)

                    # 预定义主题，置信度为 1.0
                    if self._add_relation(w1['id'], w2['id'], 1.0, new_relations, existing_relations):
                        topic_found += 1
                        total_found += 1
                    else:
                        skipped_existing += 1

            if topic_found > 0:
                stats_by_topic[topic] = topic_found

            progress.update(topic_idx + 1, f"{topic}: +{topic_found}")

        progress.finish(f"找到 {total_found} 对主题相关词")

        # 为所有未处理的单词创建日志
        for w in unprocessed:
            found_count = sum(1 for r in new_relations if r['word_id'] == w['id'])
            new_logs.append(self._create_log(w['id'], found_count))

        # 统计
        stats = {
            'total_found': total_found,
            'skipped_existing': skipped_existing,
            'by_topic': stats_by_topic,
            'processed_count': len(unprocessed)
        }

        print(f"\n   ✅ 主题关系生成完成")
        print_stat("新增关系", f"{len(new_relations)} 条（双向）")
        print_stat("跳过已存在", skipped_existing)

        # 显示前5个主题的统计
        if stats_by_topic:
            print(f"\n   📊 主题分布 (Top 5):")
            sorted_topics = sorted(stats_by_topic.items(), key=lambda x: -x[1])[:5]
            for topic, count in sorted_topics:
                print(f"      {topic}: {count}")

        return GenerationResult(relations=new_relations, logs=new_logs, stats=stats)
