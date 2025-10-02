# -*- coding: utf-8 -*-
import logging
from typing import Dict, List, Tuple
from nltk.corpus import wordnet
from web_app.models.word import Word, WordRelation, RelationType
from web_app.extensions import get_session
from web_app.scripts.word_relations.utils import batch_insert_relations
from tqdm import tqdm

logging.basicConfig(level=logging.INFO)


class SynonymGenerator:
    def __init__(self, min_confidence: float = 0.6):
        self.min_confidence = min_confidence
        self.processed_pairs = set()

    def get_wordnet_synonyms(self, word: str) -> Dict[str, float]:
        """获取WordNet同义词，返回 {synonym: confidence} 字典"""
        synonyms = {}
        word_lower = word.lower()

        # 获取所有同义词集合
        synsets = wordnet.synsets(word_lower)
        if not synsets:
            return synonyms

        for synset in synsets:
            # 同一个synset中的词都是同义词，置信度较高
            for lemma in synset.lemmas():
                syn_word = lemma.name().replace("_", " ").lower()
                if syn_word != word_lower and len(syn_word) > 1:
                    # 根据synset的频率和位置计算置信度
                    confidence = self._calculate_wordnet_confidence(synset, lemma)
                    if syn_word in synonyms:
                        synonyms[syn_word] = max(synonyms[syn_word], confidence)
                    else:
                        synonyms[syn_word] = confidence

        return {k: v for k, v in synonyms.items() if v >= self.min_confidence}

    def _calculate_wordnet_confidence(self, synset, lemma) -> float:
        """计算WordNet同义词的置信度"""
        base_confidence = 0.9

        # 根据lemma的使用频率调整
        if hasattr(lemma, "count") and lemma.count() > 0:
            # 高频词置信度更高
            freq_bonus = min(0.1, lemma.count() / 100)
            base_confidence += freq_bonus

        # 根据synset的定义长度调整（定义越详细，置信度越高）
        if hasattr(synset, "definition") and synset.definition():
            def_bonus = min(0.05, len(synset.definition().split()) / 50)
            base_confidence += def_bonus

        return min(1.0, base_confidence)

    def get_semantic_similarity_synonyms(
        self, words: List[Word]
    ) -> Dict[Tuple[int, int], float]:
        """基于语义相似性找同义词（使用WordNet路径相似性）"""
        similar_pairs = {}
        word_synsets = {}

        # 预计算每个词的synsets
        for word in words:
            synsets = wordnet.synsets(word.word.lower())
            if synsets:
                word_synsets[word.id] = synsets[:3]  # 只取前3个最相关的

        # 计算词对之间的相似性
        total_pairs = len(words) * (len(words) - 1) // 2
        processed_pairs = 0

        # 用 tqdm 包装最外层循环
        for i, w1 in enumerate(tqdm(words, desc="Processing words")):
            if w1.id not in word_synsets:
                continue

            for j, w2 in enumerate(words[i + 1 :], i + 1):
                if w2.id not in word_synsets:
                    continue

                max_similarity = 0
                for s1 in word_synsets[w1.id]:
                    for s2 in word_synsets[w2.id]:
                        sim = s1.path_similarity(s2)
                        if sim and sim > max_similarity:
                            max_similarity = sim

                # 只保留高相似性的词对
                if max_similarity >= 0.8:
                    similar_pairs[(w1.id, w2.id)] = max_similarity

        return similar_pairs

    def generate_relations(self) -> None:
        """生成同义词关系"""
        logging.info("开始生成增强同义词关系...")

        with get_session() as session:
            words = session.query(Word).all()
            word_map = {w.word.lower(): w for w in words}

            relations_to_add = []
            total_found = 0

            # 方法1: WordNet直接同义词
            logging.info("处理WordNet直接同义词...")
            for word in words:
                synonyms = self.get_wordnet_synonyms(word.word)

                for syn_word, confidence in synonyms.items():
                    if syn_word in word_map:
                        pair_key = tuple(sorted([word.id, word_map[syn_word].id]))
                        if pair_key not in self.processed_pairs:
                            self.processed_pairs.add(pair_key)
                            total_found += 1
                            relations_to_add.append(
                                WordRelation(
                                    word_id=word.id,
                                    related_word_id=word_map[syn_word].id,
                                    relation_type=RelationType.synonym,
                                    confidence=confidence,
                                )
                            )

                # 批量插入
                if len(relations_to_add) >= 1000:
                    batch_insert_relations(session, relations_to_add)
                    relations_to_add = []

            # 方法2: 语义相似性同义词
            logging.info("处理语义相似性同义词...")
            semantic_pairs = self.get_semantic_similarity_synonyms(words)

            for (w1_id, w2_id), confidence in semantic_pairs.items():
                pair_key = (w1_id, w2_id)
                if pair_key not in self.processed_pairs:
                    self.processed_pairs.add(pair_key)
                    total_found += 1
                    relations_to_add.append(
                        WordRelation(
                            word_id=w1_id,
                            related_word_id=w2_id,
                            relation_type=RelationType.synonym,
                            confidence=confidence,
                        )
                    )

            # 插入剩余关系
            if relations_to_add:
                batch_insert_relations(session, relations_to_add)

            logging.info(f"增强同义词关系生成完成，共生成 {total_found} 条关系")


def generate_synonym_relations():
    """生成同义词关系的入口函数"""
    generator = SynonymGenerator(min_confidence=0.6)
    generator.generate_relations()
