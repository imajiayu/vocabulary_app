# -*- coding: utf-8 -*-
from typing import Dict, Set, List, Tuple
from nltk.corpus import wordnet
from backend.models.word import WordRelation, RelationType
from backend.database.relation_dao import (
    db_get_all_words,
    db_batch_insert_relations,
    db_batch_check_relations_exist,
    db_get_unprocessed_word_ids,
    db_mark_words_processed
)
from .data import antonym_manual_pairs, antonym_false_paris


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


class AntonymGenerator:
    """反义词生成器 - 优化版本

    主要改进：
    1. 扩充手工反义词字典，覆盖更多常见词对
    2. 改进形态学判断，避免误判（如illusion-disillusion）
    3. 添加词根验证，确保前缀去除后的词是真实存在的
    4. 提高生成质量和覆盖率
    """

    def __init__(self):
        self.processed_pairs = set()
        self.manual_antonyms = self._build_manual_antonyms()
        # 不应该作为反义词的前缀词对（虽然有相同前缀，但不是反义词）
        self.false_prefix_pairs = self._build_false_prefix_pairs()

    def _build_false_prefix_pairs(self) -> Set[Tuple[str, str]]:
        """构建不应该作为反义词的前缀词对"""
        false_pairs = antonym_false_paris
        # 同时添加反向对
        return false_pairs | {(w2, w1) for w1, w2 in false_pairs}

    def _build_manual_antonyms(self) -> Dict[str, Set[str]]:
        """构建手工反义词字典 - 扩充版"""
        manual_pairs = antonym_manual_pairs

        manual_dict = {}
        for word1, word2 in manual_pairs:
            if word1 not in manual_dict:
                manual_dict[word1] = set()
            if word2 not in manual_dict:
                manual_dict[word2] = set()
            manual_dict[word1].add(word2)
            manual_dict[word2].add(word1)

        return manual_dict

    def get_wordnet_antonyms(self, word: str) -> Set[str]:
        """获取WordNet反义词"""
        antonyms = set()
        word_lower = word.lower()

        for synset in wordnet.synsets(word_lower):
            for lemma in synset.lemmas():
                for antonym in lemma.antonyms():
                    ant_word = antonym.name().replace("_", " ").lower()
                    if ant_word != word_lower:
                        antonyms.add(ant_word)

        return antonyms

    def get_manual_antonyms(self, word: str) -> Set[str]:
        """获取手工定义的反义词"""
        word_lower = word.lower()
        return self.manual_antonyms.get(word_lower, set())

    def get_morphological_antonyms(
        self, word: str, word_map: Dict[str, Dict]
    ) -> Set[str]:
        """通过词缀识别反义词 - 改进版

        改进：
        1. 验证去除前缀后的词是否存在于词库中
        2. 排除误判的词对
        3. 只处理真正的否定前缀
        """
        antonyms = set()
        word_lower = word.lower()

        # 否定前缀规则（更严格）
        negative_prefixes = [
            ("un", ""),  # unhappy -> happy
            ("dis", ""),  # dishonest -> honest
            ("in", ""),  # incomplete -> complete
            ("im", ""),  # immature -> mature
            ("ir", ""),  # irregular -> regular
            ("il", ""),  # illegal -> legal
            ("non", ""),  # nonprofit -> profit
        ]

        # 如果词有否定前缀，尝试去掉前缀
        for prefix, _ in negative_prefixes:
            if word_lower.startswith(prefix) and len(word_lower) > len(prefix) + 2:
                base_word = word_lower[len(prefix) :]

                # 必须满足：
                # 1. base_word在词库中存在
                # 2. 不在false_prefix_pairs中
                # 3. base_word长度合理（至少3个字母）
                if (
                    base_word in word_map
                    and len(base_word) >= 3
                    and (word_lower, base_word) not in self.false_prefix_pairs
                ):
                    antonyms.add(base_word)

        return antonyms

    def calculate_antonym_confidence(
        self, word1: str, word2: str, source: str
    ) -> float:
        """计算反义词置信度"""
        if source == "wordnet":
            return 1.0
        elif source == "manual":
            return 0.95
        elif source == "morphological":
            return 0.85  # 提高形态学的置信度，因为现在更准确了
        else:
            return 0.7

    def generate_relations(self, emitter=None) -> int:
        """生成反义词关系（自动增量模式）

        只处理未在日志表中的单词，已处理的单词会自动跳过。
        如需重新生成，请先调用 db_clear_relations(['antonym'])

        参数:
        - emitter: 进度发射器
        """
        all_words = db_get_all_words()
        word_map = {w["word"].lower(): w for w in all_words}

        # 自动增量：只处理未处理的单词
        unprocessed_ids = db_get_unprocessed_word_ids(RelationType.antonym)
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
            emitter.emit_progress(0, total, "Starting antonym generation...")

        for i, word in enumerate(words_data):
            if emitter and i % 100 == 0:
                # 计算当前发现和插入的总数（包括待处理的）
                current_found = total_found + len(relations_to_check)
                current_inserted = total_found - skipped_count
                emitter.emit_progress(
                    i,
                    total,
                    f"Processing antonyms: {i}/{total} words, found {current_found}, inserted {current_inserted}"
                )

            all_antonyms = {}

            # 1. WordNet反义词（最高优先级）
            wordnet_antonyms = self.get_wordnet_antonyms(word["word"])
            for ant in wordnet_antonyms:
                all_antonyms[ant] = "wordnet"

            # 2. 手工反义词（第二优先级）
            manual_antonyms = self.get_manual_antonyms(word["word"])
            for ant in manual_antonyms:
                if ant not in all_antonyms:  # WordNet优先
                    all_antonyms[ant] = "manual"

            # 3. 形态学反义词（仅当前两种方法找不到时）
            if not all_antonyms:
                morphological_antonyms = self.get_morphological_antonyms(
                    word["word"], word_map
                )
                for ant in morphological_antonyms:
                    all_antonyms[ant] = "morphological"

            # 创建关系
            for ant_word, source in all_antonyms.items():
                if ant_word in word_map and ant_word != word["word"].lower():
                    pair_key = tuple(sorted([word["id"], word_map[ant_word]["id"]]))
                    if pair_key not in self.processed_pairs:
                        self.processed_pairs.add(pair_key)
                        confidence = self.calculate_antonym_confidence(
                            word["word"], ant_word, source
                        )

                        relations_to_check.append({
                            'word_id': word["id"],
                            'related_word_id': word_map[ant_word]["id"],
                            'relation_type': RelationType.antonym,
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
                        f"Processing antonyms: {i}/{total} words, found {total_found}, inserted {total_found - skipped_count}",
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

        # 标记所有处理过的单词
        db_mark_words_processed(
            [w['id'] for w in words_data],
            RelationType.antonym
        )

        if emitter:
            emitter.emit_progress(total, total, f"Completed! Added {total_found}, skipped {skipped_count} existing")

        return total_found


def generate_antonym_relations():
    """生成反义词关系的入口函数"""
    generator = AntonymGenerator()
    return generator.generate_relations()
