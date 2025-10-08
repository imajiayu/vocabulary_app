# -*- coding: utf-8 -*-
from collections import defaultdict
from typing import Dict, List, Set, Tuple
from nltk.corpus import wordnet
from web_app.models.word import WordRelation, RelationType
from web_app.database.relation_dao import db_get_all_words, db_batch_insert_relations
from .data import topic_seeds


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


class SemanticTopicGenerator:
    """基于语义相似性的主题关系生成器"""

    def __init__(self, min_confidence: float = 0.7):
        self.min_confidence = min_confidence
        self.processed_pairs = set()

        # 定义核心主题和它们的种子词
        self.topic_seeds = topic_seeds

    def expand_topic_words(self, seed_words: Set[str]) -> Set[str]:
        """扩展主题词汇，通过WordNet找到相关词"""
        expanded = set(seed_words)

        for word in seed_words:
            # 获取同义词
            for synset in wordnet.synsets(word):
                for lemma in synset.lemmas():
                    expanded.add(lemma.name().lower().replace("_", " "))

                # 获取下位词（更具体的概念）
                for hypo in synset.hyponyms():
                    for lemma in hypo.lemmas():
                        expanded.add(lemma.name().lower().replace("_", " "))

                # 获取上位词（更一般的概念）
                for hyper in synset.hypernyms():
                    for lemma in hyper.lemmas():
                        expanded.add(lemma.name().lower().replace("_", " "))

        return expanded

    def calculate_semantic_similarity(self, word1: str, word2: str) -> float:
        """计算两个词的语义相似度"""
        synsets1 = wordnet.synsets(word1.lower())
        synsets2 = wordnet.synsets(word2.lower())

        if not synsets1 or not synsets2:
            return 0.0

        max_similarity = 0.0

        # 计算所有synset对的最大相似度
        for s1 in synsets1[:3]:  # 只取前3个最相关的synset
            for s2 in synsets2[:3]:
                # 使用多种相似度计算方法
                similarities = []

                # 路径相似度
                path_sim = s1.path_similarity(s2)
                if path_sim:
                    similarities.append(path_sim)

                # Wu-Palmer相似度
                wup_sim = s1.wup_similarity(s2)
                if wup_sim:
                    similarities.append(wup_sim)

                # 最短路径相似度
                try:
                    lch_sim = s1.lch_similarity(s2)
                    if lch_sim:
                        similarities.append(min(1.0, lch_sim / 3.0))  # 归一化
                except:
                    pass

                if similarities:
                    avg_sim = sum(similarities) / len(similarities)
                    max_similarity = max(max_similarity, avg_sim)

        return max_similarity

    def get_word_topic_scores(self, word: str) -> Dict[str, float]:
        """计算单词在各个主题下的得分"""
        word_lower = word.lower()
        topic_scores = {}

        for topic, seed_words in self.topic_seeds.items():
            max_score = 0.0

            # 直接匹配
            if word_lower in seed_words:
                max_score = 1.0
            else:
                # 计算与种子词的语义相似度
                for seed_word in seed_words:
                    similarity = self.calculate_semantic_similarity(
                        word_lower, seed_word
                    )
                    max_score = max(max_score, similarity)

            if max_score >= 0.3:  # 只保留有意义的关联
                topic_scores[topic] = max_score

        return topic_scores

    def find_topically_related_words(
        self, words: List[Dict], emitter=None
    ) -> List[Tuple[Dict, Dict, float]]:
        """找到主题相关的词对"""
        word_topics = {}
        total = len(words)

        # 为每个词计算主题得分
        for i, word in enumerate(words):
            if emitter and i % 100 == 0:
                emitter.emit_progress(
                    i, total, f"Computing topic scores: {i}/{total} words"
                )

            topic_scores = self.get_word_topic_scores(word["word"])
            if topic_scores:  # 只保留有主题关联的词
                word_topics[i] = (word, topic_scores)

        # 找到主题相关的词对
        related_pairs = []
        word_indices = list(word_topics.keys())
        total_with_topics = len(word_indices)

        for i, idx1 in enumerate(word_indices):
            if emitter and i % 100 == 0:
                emitter.emit_progress(
                    i,
                    total_with_topics,
                    f"Computing topic pairs: {i}/{total_with_topics} words",
                )

            w1, topics1 = word_topics[idx1]

            for j in range(i + 1, len(word_indices)):
                idx2 = word_indices[j]
                w2, topics2 = word_topics[idx2]

                # 找到共同主题
                common_topics = set(topics1.keys()) & set(topics2.keys())

                if common_topics:
                    # 计算最高的主题相似度
                    max_topic_sim = 0.0
                    for topic in common_topics:
                        # 使用几何平均数计算主题相似度
                        topic_sim = (topics1[topic] * topics2[topic]) ** 0.5
                        max_topic_sim = max(max_topic_sim, topic_sim)

                    # 加入语义相似度作为额外验证
                    semantic_sim = self.calculate_semantic_similarity(
                        w1["word"], w2["word"]
                    )

                    # 综合评分
                    final_score = max_topic_sim * 0.7 + semantic_sim * 0.3

                    if final_score >= self.min_confidence:
                        related_pairs.append((w1, w2, final_score))

        return related_pairs

    def generate_relations(self, emitter=None) -> int:
        """生成主题关系"""
        words_data = db_get_all_words()
        total = len(words_data)

        if emitter:
            emitter.emit_progress(0, total, "Starting topic relation generation...")

        # 扩展主题词汇
        num_topics = len(self.topic_seeds)
        for i, topic in enumerate(self.topic_seeds):
            if emitter:
                emitter.emit_progress(i, num_topics, f"Expanding topic: {topic}")
            self.topic_seeds[topic] = self.expand_topic_words(self.topic_seeds[topic])

        # 找到主题相关的词对
        related_pairs = self.find_topically_related_words(words_data, emitter)

        # 创建关系
        relations_to_add = []
        for w1, w2, confidence in related_pairs:
            relations_to_add.append(
                WordRelation(
                    word_id=w1["id"],
                    related_word_id=w2["id"],
                    relation_type=RelationType.topic,
                    confidence=confidence,
                )
            )

            # 批量插入
            if len(relations_to_add) >= 1000:
                _save_relations(relations_to_add)
                relations_to_add = []

        # 处理剩余关系
        _save_relations(relations_to_add)

        return len(related_pairs)


def generate_topic_relations():
    """生成主题关系的入口函数"""
    generator = SemanticTopicGenerator(min_confidence=0.7)
    return generator.generate_relations()
