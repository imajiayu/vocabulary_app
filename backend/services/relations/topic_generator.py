# -*- coding: utf-8 -*-
import json
import os
from typing import Dict, List, Set
from backend.models.word import WordRelation, RelationType
from backend.database.relation_dao import (
    db_get_all_words,
    db_batch_insert_relations,
    db_batch_check_relations_exist,
    db_get_unprocessed_word_ids,
    db_mark_words_processed
)


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


class IELTSTopicGenerator:
    """基于IELTS预定义主题的关系生成器

    使用my-ielts项目中的22个主题分类，将词汇聚合到对应的主题cluster中。
    只为在my-ielts词库中的单词建立topic关系。
    """

    def __init__(self):
        self.topic_words = self._load_ielts_topics()
        # 构建单词到主题的反向索引
        self.word_to_topics = self._build_word_index()

    def _load_ielts_topics(self) -> Dict[str, List[str]]:
        """加载IELTS主题词汇数据"""
        data_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            'data'
        )
        json_path = os.path.join(data_dir, 'ielts_topics.json')

        with open(json_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _build_word_index(self) -> Dict[str, Set[str]]:
        """构建单词到主题的反向索引"""
        word_index = {}

        for topic, words in self.topic_words.items():
            for word in words:
                if word not in word_index:
                    word_index[word] = set()
                word_index[word].add(topic)

        return word_index

    def generate_relations(self, emitter=None) -> int:
        """生成主题关系（自动增量模式）

        只处理未在日志表中的单词，已处理的单词会自动跳过。
        如需重新生成，请先调用 db_clear_relations(['topic'])

        参数:
        - emitter: 进度发射器
        """
        all_words = db_get_all_words()
        word_map = {w['word'].lower(): w for w in all_words}

        # 自动增量：只处理未处理的单词
        unprocessed_ids = db_get_unprocessed_word_ids(RelationType.topic)
        words_data = [w for w in all_words if w['id'] in unprocessed_ids]

        if emitter:
            emitter.emit_progress(
                0, len(words_data),
                f"Processing {len(words_data)} unprocessed words"
            )

        # 只保留在IELTS词库中的单词
        ielts_words = []
        for word in words_data:
            if word['word'].lower() in self.word_to_topics:
                ielts_words.append(word)

        if emitter:
            emitter.emit_progress(
                0, len(ielts_words),
                f"Found {len(ielts_words)} words in IELTS topics (out of {len(words_data)})"
            )

        total = len(ielts_words)
        relations_to_add = []
        relations_to_check = []
        total_found = 0
        skipped_count = 0
        processed_pairs = set()

        # 为每个主题内的词建立关系
        for topic, topic_word_list in self.topic_words.items():
            # 找出该主题下在当前词库中的单词
            words_in_topic = []
            for word_str in topic_word_list:
                if word_str in word_map:
                    word_obj = word_map[word_str]
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

                    relations_to_check.append({
                        'word_id': w1['id'],
                        'related_word_id': w2['id'],
                        'relation_type': RelationType.topic,
                        'confidence': 1.0,  # 预定义主题，置信度为1.0
                    })

            # 批量检查和插入
            if len(relations_to_check) >= 1000:
                exists_dict = db_batch_check_relations_exist(relations_to_check)
                batch_found = 0
                batch_skipped = 0

                for rel in relations_to_check:
                    key = (
                        min(rel['word_id'], rel['related_word_id']),
                        max(rel['word_id'], rel['related_word_id']),
                        rel['relation_type']
                    )
                    if not exists_dict.get(key, False):
                        relations_to_add.append(WordRelation(**rel))
                        batch_found += 1
                    else:
                        batch_skipped += 1

                _save_relations(relations_to_add)
                total_found += batch_found
                skipped_count += batch_skipped

                if emitter:
                    current_inserted = total_found - skipped_count
                    emitter.emit_progress(
                        total_found,
                        total,
                        f"Processing topic: {topic}, found {total_found}, inserted {current_inserted}"
                    )

                relations_to_add = []
                relations_to_check = []

        # 检查并插入剩余关系
        if relations_to_check:
            exists_dict = db_batch_check_relations_exist(relations_to_check)
            for rel in relations_to_check:
                key = (
                    min(rel['word_id'], rel['related_word_id']),
                    max(rel['word_id'], rel['related_word_id']),
                    rel['relation_type']
                )
                if not exists_dict.get(key, False):
                    relations_to_add.append(WordRelation(**rel))
                    total_found += 1
                else:
                    skipped_count += 1

        _save_relations(relations_to_add)

        # 标记所有处理过的单词（包括不在IELTS词库中的）
        db_mark_words_processed(
            [w['id'] for w in words_data],
            RelationType.topic
        )

        if emitter:
            emitter.emit_progress(
                total, total,
                f"Completed! Added {total_found} relations, skipped {skipped_count} existing"
            )

        return total_found


def generate_topic_relations():
    """生成主题关系的入口函数"""
    generator = IELTSTopicGenerator()
    return generator.generate_relations()
