# -*- coding: utf-8 -*-
import logging
from typing import Dict, Set, List, Tuple
from nltk.corpus import wordnet
from web_app.models.word import Word, WordRelation, RelationType
from web_app.extensions import get_session
from web_app.scripts.word_relations.utils import batch_insert_relations

logger = logging.getLogger(__name__)


class AntonymGenerator:
    """反义词生成器 - 解决原来反义词太少的问题"""

    def __init__(self):
        self.processed_pairs = set()
        # 手工补充的反义词对（WordNet覆盖不足的）
        self.manual_antonyms = self._build_manual_antonyms()

    def _build_manual_antonyms(self) -> Dict[str, Set[str]]:
        """构建手工反义词字典，补充WordNet的不足"""
        manual_pairs = [
            # 基础形容词对
            ("big", "small"),
            ("large", "small"),
            ("huge", "tiny"),
            ("hot", "cold"),
            ("warm", "cool"),
            ("bright", "dark"),
            ("light", "heavy"),
            ("fast", "slow"),
            ("quick", "slow"),
            ("high", "low"),
            ("tall", "short"),
            ("wide", "narrow"),
            ("thick", "thin"),
            ("strong", "weak"),
            ("hard", "soft"),
            ("rough", "smooth"),
            ("sharp", "dull"),
            ("clean", "dirty"),
            ("new", "old"),
            ("fresh", "stale"),
            ("young", "old"),
            ("early", "late"),
            ("first", "last"),
            ("front", "back"),
            ("top", "bottom"),
            ("up", "down"),
            ("in", "out"),
            ("inside", "outside"),
            ("near", "far"),
            ("close", "distant"),
            # 情感和态度
            ("happy", "sad"),
            ("glad", "sad"),
            ("joyful", "sorrowful"),
            ("cheerful", "gloomy"),
            ("optimistic", "pessimistic"),
            ("positive", "negative"),
            ("confident", "insecure"),
            ("brave", "cowardly"),
            ("bold", "timid"),
            ("calm", "anxious"),
            ("relaxed", "stressed"),
            ("patient", "impatient"),
            # 行为和动作
            ("start", "stop"),
            ("begin", "end"),
            ("open", "close"),
            ("push", "pull"),
            ("give", "take"),
            ("buy", "sell"),
            ("increase", "decrease"),
            ("rise", "fall"),
            ("win", "lose"),
            ("succeed", "fail"),
            ("advance", "retreat"),
            ("attack", "defend"),
            ("create", "destroy"),
            ("build", "demolish"),
            ("unite", "divide"),
            # 时间和空间
            ("before", "after"),
            ("past", "future"),
            ("ancient", "modern"),
            ("temporary", "permanent"),
            ("brief", "lengthy"),
            ("left", "right"),
            ("east", "west"),
            ("north", "south"),
            # 数量和程度
            ("more", "less"),
            ("most", "least"),
            ("many", "few"),
            ("maximum", "minimum"),
            ("increase", "decrease"),
            ("majority", "minority"),
            ("full", "empty"),
            # 社会和道德
            ("rich", "poor"),
            ("wealthy", "poor"),
            ("expensive", "cheap"),
            ("legal", "illegal"),
            ("public", "private"),
            ("formal", "informal"),
            ("polite", "rude"),
            ("honest", "dishonest"),
            ("truth", "lie"),
            ("right", "wrong"),
            ("good", "bad"),
            ("virtue", "vice"),
            # 学术和工作
            ("difficult", "easy"),
            ("complex", "simple"),
            ("hard", "easy"),
            ("advanced", "basic"),
            ("professional", "amateur"),
            ("skilled", "unskilled"),
            ("experienced", "inexperienced"),
        ]

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

    def get_morphological_antonyms(self, word: str) -> Set[str]:
        """通过词缀识别反义词（如 un-, dis-, in-, im- 等）"""
        antonyms = set()
        word_lower = word.lower()

        # 否定前缀规则
        negative_prefixes = [
            ("un", ""),
            ("dis", ""),
            ("in", ""),
            ("im", ""),
            ("ir", ""),
            ("il", ""),
            ("non", ""),
            ("anti", ""),
            ("de", ""),
            ("mis", ""),
        ]

        # 如果词有否定前缀，尝试去掉前缀
        for prefix, _ in negative_prefixes:
            if word_lower.startswith(prefix) and len(word_lower) > len(prefix) + 2:
                base_word = word_lower[len(prefix) :]
                antonyms.add(base_word)

        # 如果词没有否定前缀，尝试加上前缀
        else:
            for prefix, _ in negative_prefixes:
                if prefix in ["un", "in", "dis"]:  # 最常用的前缀
                    potential_antonym = prefix + word_lower
                    antonyms.add(potential_antonym)

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
            # 形态学反义词需要验证
            return 0.8
        else:
            return 0.7

    def generate_relations(self) -> None:
        """生成反义词关系"""
        logger.info("开始生成增强反义词关系...")

        with get_session() as session:
            words = session.query(Word).all()
            word_map = {w.word.lower(): w for w in words}

            relations_to_add = []
            total_found = 0

            for word in words:
                all_antonyms = {}

                # 1. WordNet反义词
                wordnet_antonyms = self.get_wordnet_antonyms(word.word)
                for ant in wordnet_antonyms:
                    all_antonyms[ant] = "wordnet"

                # 2. 手工反义词
                manual_antonyms = self.get_manual_antonyms(word.word)
                for ant in manual_antonyms:
                    if ant not in all_antonyms:  # WordNet优先
                        all_antonyms[ant] = "manual"

                # 3. 形态学反义词（仅当前两种方法找不到时）
                if not all_antonyms:
                    morphological_antonyms = self.get_morphological_antonyms(word.word)
                    for ant in morphological_antonyms:
                        all_antonyms[ant] = "morphological"

                # 创建关系
                for ant_word, source in all_antonyms.items():
                    if ant_word in word_map and ant_word != word.word.lower():
                        pair_key = tuple(sorted([word.id, word_map[ant_word].id]))
                        if pair_key not in self.processed_pairs:
                            self.processed_pairs.add(pair_key)
                            confidence = self.calculate_antonym_confidence(
                                word.word, ant_word, source
                            )

                            total_found += 1
                            relations_to_add.append(
                                WordRelation(
                                    word_id=word.id,
                                    related_word_id=word_map[ant_word].id,
                                    relation_type=RelationType.antonym,
                                    confidence=confidence,
                                )
                            )

                # 批量插入
                if len(relations_to_add) >= 1000:
                    batch_insert_relations(session, relations_to_add)
                    relations_to_add = []

            # 插入剩余关系
            if relations_to_add:
                batch_insert_relations(session, relations_to_add)

            logger.info(f"增强反义词关系生成完成，共生成 {total_found} 条关系")


def generate_antonym_relations():
    """生成反义词关系的入口函数"""
    generator = AntonymGenerator()
    generator.generate_relations()
