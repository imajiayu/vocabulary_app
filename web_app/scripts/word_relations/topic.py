# -*- coding: utf-8 -*-
import logging
from collections import defaultdict
from typing import Dict, List, Set, Tuple
from nltk.corpus import wordnet
from web_app.models.word import Word, WordRelation, RelationType
from web_app.extensions import get_session
from web_app.scripts.word_relations.utils import batch_insert_relations

logger = logging.getLogger(__name__)


class SemanticTopicGenerator:
    """基于语义相似性的主题关系生成器"""

    def __init__(self, min_confidence: float = 0.7):
        self.min_confidence = min_confidence
        self.processed_pairs = set()

        # 定义核心主题和它们的种子词
        self.topic_seeds = {
            "education": {
                "study",
                "learn",
                "teach",
                "school",
                "university",
                "student",
                "teacher",
                "education",
                "knowledge",
                "academic",
                "curriculum",
                "degree",
                "diploma",
                "lecture",
                "professor",
                "scholarship",
                "research",
                "library",
                "classroom",
            },
            "business": {
                "business",
                "company",
                "profit",
                "market",
                "economy",
                "trade",
                "commerce",
                "finance",
                "money",
                "investment",
                "management",
                "corporate",
                "industry",
                "customer",
                "service",
                "product",
                "sales",
                "revenue",
                "budget",
                "strategy",
            },
            "health": {
                "health",
                "medical",
                "doctor",
                "hospital",
                "disease",
                "treatment",
                "medicine",
                "patient",
                "therapy",
                "surgery",
                "diagnosis",
                "symptom",
                "cure",
                "prevention",
                "nutrition",
                "exercise",
                "wellness",
                "clinic",
                "nurse",
                "pharmaceutical",
            },
            "technology": {
                "technology",
                "computer",
                "software",
                "digital",
                "internet",
                "data",
                "system",
                "innovation",
                "development",
                "programming",
                "algorithm",
                "network",
                "device",
                "artificial",
                "intelligence",
                "automation",
                "electronic",
                "cyber",
                "virtual",
            },
            "environment": {
                "environment",
                "nature",
                "climate",
                "pollution",
                "conservation",
                "ecology",
                "sustainability",
                "renewable",
                "carbon",
                "emission",
                "biodiversity",
                "ecosystem",
                "forest",
                "wildlife",
                "ocean",
                "atmosphere",
                "recycling",
                "green",
                "organic",
            },
            "social": {
                "society",
                "community",
                "culture",
                "social",
                "relationship",
                "family",
                "friend",
                "communication",
                "language",
                "tradition",
                "custom",
                "behavior",
                "psychology",
                "anthropology",
                "sociology",
                "demographics",
                "civilization",
                "heritage",
            },
            "science": {
                "science",
                "research",
                "experiment",
                "theory",
                "hypothesis",
                "laboratory",
                "analysis",
                "discovery",
                "investigation",
                "methodology",
                "physics",
                "chemistry",
                "biology",
                "mathematics",
                "statistics",
                "evidence",
                "observation",
                "data",
            },
            "art": {
                "art",
                "creative",
                "design",
                "aesthetic",
                "beauty",
                "artist",
                "painting",
                "sculpture",
                "music",
                "literature",
                "poetry",
                "drama",
                "theater",
                "gallery",
                "museum",
                "exhibition",
                "performance",
                "cultural",
                "artistic",
                "expression",
            },
        }

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
        self, words: List[Word]
    ) -> List[Tuple[Word, Word, float]]:
        """找到主题相关的词对"""
        word_topics = {}

        # 为每个词计算主题得分
        logger.info("计算词汇主题得分...")
        for word in words:
            topic_scores = self.get_word_topic_scores(word.word)
            if topic_scores:  # 只保留有主题关联的词
                word_topics[word] = topic_scores

        logger.info(f"有主题关联的词汇数量: {len(word_topics)}")

        # 找到主题相关的词对
        related_pairs = []
        words_with_topics = list(word_topics.keys())

        logger.info("计算词对主题相似度...")
        for i, w1 in enumerate(words_with_topics):
            if i % 100 == 0:
                logger.info(f"已处理 {i}/{len(words_with_topics)} 个词")

            for j in range(i + 1, len(words_with_topics)):
                w2 = words_with_topics[j]

                # 计算主题相似度
                topics1 = word_topics[w1]
                topics2 = word_topics[w2]

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
                    semantic_sim = self.calculate_semantic_similarity(w1.word, w2.word)

                    # 综合评分
                    final_score = max_topic_sim * 0.7 + semantic_sim * 0.3

                    if final_score >= self.min_confidence:
                        related_pairs.append((w1, w2, final_score))

        return related_pairs

    def generate_relations(self) -> None:
        """生成主题关系"""
        logger.info("开始生成基于语义的主题关系...")

        with get_session() as session:
            words = session.query(Word).all()
            logger.info(f"总单词数: {len(words)}")

            # 扩展主题词汇
            logger.info("扩展主题词汇...")
            for topic in self.topic_seeds:
                original_size = len(self.topic_seeds[topic])
                self.topic_seeds[topic] = self.expand_topic_words(
                    self.topic_seeds[topic]
                )
                logger.info(
                    f"主题 '{topic}': {original_size} -> {len(self.topic_seeds[topic])} 个词"
                )

            # 找到主题相关的词对
            related_pairs = self.find_topically_related_words(words)
            logger.info(f"找到 {len(related_pairs)} 个主题相关词对")

            # 创建关系
            relations_to_add = []
            for w1, w2, confidence in related_pairs:
                relations_to_add.append(
                    WordRelation(
                        word_id=w1.id,
                        related_word_id=w2.id,
                        relation_type=RelationType.topic,
                        confidence=confidence,
                    )
                )

                # 批量插入
                if len(relations_to_add) >= 1000:
                    batch_insert_relations(session, relations_to_add)
                    relations_to_add = []

            # 处理剩余关系
            if relations_to_add:
                batch_insert_relations(session, relations_to_add)

            logger.info(
                f"基于语义的主题关系生成完成，共生成 {len(related_pairs)} 条关系"
            )


def generate_topic_relations():
    """生成主题关系的入口函数"""
    generator = SemanticTopicGenerator(min_confidence=0.7)
    generator.generate_relations()
