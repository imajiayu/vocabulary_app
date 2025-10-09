# -*- coding: utf-8 -*-
from typing import Dict, List, Tuple
from functools import lru_cache
from nltk.corpus import wordnet
from web_app.models.word import WordRelation, RelationType
from web_app.database.relation_dao import (
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


class SynonymGenerator:
    def __init__(self, min_confidence: float = 0.6):
        self.min_confidence = min_confidence
        self.processed_pairs = set()
        self.similarity_cache = {}

    @staticmethod
    @lru_cache(maxsize=10000)
    def _get_synsets(word: str):
        """缓存WordNet synsets查询"""
        return wordnet.synsets(word.lower())

    def get_wordnet_synonyms(self, word: str) -> Dict[str, float]:
        """获取WordNet同义词，返回 {synonym: confidence} 字典"""
        synonyms = {}
        word_lower = word.lower()

        # 获取所有同义词集合
        synsets = self._get_synsets(word_lower)
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
        self, words: List[Dict], emitter=None, base_found=0, base_skipped=0
    ) -> Dict[Tuple[int, int], float]:
        """基于语义相似性找同义词（使用WordNet路径相似性）"""
        similar_pairs = {}
        word_synsets = {}

        # 预计算每个词的synsets
        for word in words:
            synsets = self._get_synsets(word['word'])
            if synsets:
                word_synsets[word['id']] = synsets[:3]  # 只取前3个最相关的

        # 过滤出有synsets的词，减少无效迭代
        words_with_synsets = [w for w in words if w['id'] in word_synsets]
        total = len(words_with_synsets)

        for i, w1 in enumerate(words_with_synsets):
            if emitter and i % 10 == 0:  # 每10个单词报告一次（语义计算很慢）
                # 语义相似性找到的关系数量（还未插入数据库）
                semantic_found = len(similar_pairs)
                current_found = base_found + semantic_found
                current_inserted = base_found - base_skipped  # 只计算已插入的，语义相似性的还未插入
                emitter.emit_progress(
                    i,
                    total,
                    f"Computing semantic similarity: {i}/{total} words, total found {current_found}, total inserted {current_inserted}"
                )

            for w2 in words_with_synsets[i + 1 :]:
                max_similarity = 0
                found_high_sim = False

                for s1 in word_synsets[w1['id']]:
                    for s2 in word_synsets[w2['id']]:
                        # 使用缓存避免重复计算
                        cache_key = (id(s1), id(s2))
                        if cache_key in self.similarity_cache:
                            sim = self.similarity_cache[cache_key]
                        else:
                            sim = s1.path_similarity(s2)
                            if sim is not None:
                                self.similarity_cache[cache_key] = sim

                        if sim and sim >= 0.8:
                            max_similarity = sim
                            found_high_sim = True
                            break  # 找到高相似性，提前终止内层循环

                    if found_high_sim:
                        break  # 提前终止外层循环

                # 只保留高相似性的词对
                if max_similarity >= 0.8:
                    similar_pairs[(w1['id'], w2['id'])] = max_similarity

        return similar_pairs

    def generate_relations(self, emitter=None) -> int:
        """生成同义词关系（自动增量模式）

        只处理未在日志表中的单词，已处理的单词会自动跳过。
        如需重新生成，请先调用 db_clear_relations(['synonym'])

        参数:
        - emitter: 进度发射器
        """
        all_words = db_get_all_words()
        word_map = {w['word'].lower(): w for w in all_words}

        # 自动增量：只处理未处理的单词
        unprocessed_ids = db_get_unprocessed_word_ids(RelationType.synonym)
        words_data = [w for w in all_words if w['id'] in unprocessed_ids]

        if emitter:
            emitter.emit_progress(
                0, len(words_data),
                f"Processing {len(words_data)} unprocessed words"
            )

        relations_to_add = []
        relations_to_check = []
        total_found = 0
        skipped_count = 0
        total = len(words_data)

        if emitter:
            emitter.emit_progress(0, total, "Starting synonym generation...")

        # 方法1: WordNet直接同义词
        for i, word in enumerate(words_data):
            if emitter and i % 100 == 0:
                # 计算当前发现和插入的总数（包括待处理的）
                current_found = total_found + len(relations_to_check)
                current_inserted = total_found - skipped_count
                emitter.emit_progress(
                    i,
                    total,
                    f"Processing synonyms: {i}/{total} words, found {current_found}, inserted {current_inserted}"
                )

            synonyms = self.get_wordnet_synonyms(word['word'])

            for syn_word, confidence in synonyms.items():
                if syn_word in word_map:
                    pair_key = tuple(sorted([word['id'], word_map[syn_word]['id']]))
                    if pair_key not in self.processed_pairs:
                        self.processed_pairs.add(pair_key)
                        relations_to_check.append({
                            'word_id': word['id'],
                            'related_word_id': word_map[syn_word]['id'],
                            'relation_type': RelationType.synonym,
                            'confidence': confidence,
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

                # 批量插入后立即报告进度
                if emitter:
                    emitter.emit_progress(
                        i,
                        total,
                        f"Processing synonyms: {i}/{total} words, found {total_found}, inserted {total_found - skipped_count}",
                    )

                relations_to_add = []
                relations_to_check = []

        # 方法2: 语义相似性同义词
        if emitter:
            current_inserted = total_found - skipped_count
            emitter.emit_progress(
                total,
                total * 2,  # 总进度分为两部分：WordNet + 语义相似性
                f"Starting semantic similarity (WordNet found {total_found}, inserted {current_inserted})"
            )

        semantic_pairs = self.get_semantic_similarity_synonyms(words_data, emitter, total_found, skipped_count)

        for (w1_id, w2_id), confidence in semantic_pairs.items():
            pair_key = (w1_id, w2_id)
            if pair_key not in self.processed_pairs:
                self.processed_pairs.add(pair_key)
                relations_to_check.append({
                    'word_id': w1_id,
                    'related_word_id': w2_id,
                    'relation_type': RelationType.synonym,
                    'confidence': confidence,
                })

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

        # 标记所有处理过的单词（包括没找到关系的）
        db_mark_words_processed(
            [w['id'] for w in words_data],
            RelationType.synonym
        )

        if emitter:
            emitter.emit_progress(total, total, f"Completed! Added {total_found}, skipped {skipped_count} existing")

        return total_found


def generate_synonym_relations():
    """生成同义词关系的入口函数"""
    generator = SynonymGenerator(min_confidence=0.6)
    return generator.generate_relations()
