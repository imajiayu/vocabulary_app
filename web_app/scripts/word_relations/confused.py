# -*- coding: utf-8 -*-
import logging
from difflib import SequenceMatcher
from typing import Dict, Set, Tuple, List
from nltk.corpus import wordnet
from web_app.models.word import Word, WordRelation, RelationType
from web_app.extensions import get_session
from web_app.scripts.word_relations.utils import batch_insert_relations

logger = logging.getLogger(__name__)


class ConfusedWordsGenerator:
    """易混淆词生成器 - 专注于形似义不同的词对"""

    def __init__(self, min_length: int = 4):
        self.min_length = min_length
        self.processed_pairs = set()
        # 经典易混淆词对
        self.classic_confused_pairs = self._build_classic_pairs()

    def _build_classic_pairs(self) -> Set[Tuple[str, str]]:
        """构建经典易混淆词对"""
        pairs = [
            # 经典易混淆对
            ("affect", "effect"),
            ("accept", "except"),
            ("advice", "advise"),
            ("desert", "dessert"),
            ("lose", "loose"),
            ("principal", "principle"),
            ("stationary", "stationery"),
            ("complement", "compliment"),
            ("council", "counsel"),
            ("discrete", "discreet"),
            ("elicit", "illicit"),
            ("emigrate", "immigrate"),
            ("ensure", "insure"),
            ("farther", "further"),
            ("imply", "infer"),
            ("its", "it's"),
            ("lead", "led"),
            ("passed", "past"),
            ("personal", "personnel"),
            ("than", "then"),
            ("there", "their"),
            ("to", "too"),
            ("weather", "whether"),
            ("who", "whom"),
            # 学术词汇易混淆对
            ("adapt", "adopt"),
            ("adverse", "averse"),
            ("alternate", "alternative"),
            ("appraise", "apprise"),
            ("assure", "ensure"),
            ("capital", "capitol"),
            ("cite", "sight"),
            ("climatic", "climactic"),
            ("compose", "comprise"),
            ("continual", "continuous"),
            ("credible", "credulous"),
            ("definite", "definitive"),
            ("economic", "economical"),
            ("eminent", "imminent"),
            ("explicit", "implicit"),
            ("historic", "historical"),
            ("judicial", "judicious"),
            ("literal", "literary"),
            ("moral", "morale"),
            ("official", "officious"),
            ("practical", "practicable"),
            ("respectful", "respective"),
            ("sensual", "sensuous"),
            ("substantial", "substantive"),
            ("temporal", "temporary"),
            # 形似词对
            ("angel", "angle"),
            ("casual", "causal"),
            ("dessert", "desert"),
            ("martial", "martial"),
            ("metal", "mental"),
            ("moral", "mortal"),
            ("statue", "statute"),
            ("trail", "trial"),
            ("unity", "utility"),
            ("access", "excess"),
            ("altar", "alter"),
            ("breath", "breathe"),
            ("cloth", "clothe"),
            ("dairy", "diary"),
            ("decent", "descent"),
            ("device", "devise"),
            ("human", "humane"),
            ("later", "latter"),
            ("lighting", "lightning"),
            ("loose", "lose"),
            ("quite", "quiet"),
            # 容易拼写错误的对
            ("separate", "desperate"),
            ("definitely", "defiantly"),
            ("conscious", "conscience"),
            ("lightning", "lightening"),
            ("exercise", "exorcise"),
            ("perspective", "prospective"),
            ("ridiculous", "rigorous"),
            ("independence", "independents"),
        ]

        # 转换为集合，同时添加反向对
        pair_set = set()
        for w1, w2 in pairs:
            pair_set.add((w1.lower(), w2.lower()))
            pair_set.add((w2.lower(), w1.lower()))

        return pair_set

    def are_semantically_different(self, word1: str, word2: str) -> bool:
        """检查两个词在语义上是否不同（避免同义词被标记为易混淆）"""
        synsets1 = set(wordnet.synsets(word1.lower()))
        synsets2 = set(wordnet.synsets(word2.lower()))

        if not synsets1 or not synsets2:
            return True  # 如果任一词没有WordNet条目，认为不同

        # 检查是否有共同的synset（同义词）
        if synsets1 & synsets2:
            return False

        # 检查语义相似度
        max_similarity = 0
        for s1 in synsets1:
            for s2 in synsets2:
                sim = s1.path_similarity(s2)
                if sim and sim > max_similarity:
                    max_similarity = sim

        # 如果语义相似度太高，不算易混淆
        return max_similarity < 0.3

    def calculate_confusion_score(self, word1: str, word2: str) -> Tuple[bool, float]:
        """计算易混淆分数"""
        w1, w2 = word1.lower(), word2.lower()

        # 长度差异太大，不太可能混淆
        if abs(len(w1) - len(w2)) > 3:
            return False, 0.0

        # 计算字符串相似度
        similarity = SequenceMatcher(None, w1, w2).ratio()

        # 基础相似度要求
        if similarity < 0.6:
            return False, 0.0

        # 检查是否是经典易混淆对
        if (w1, w2) in self.classic_confused_pairs:
            return True, 0.95

        # 语义检查：必须语义不同才算易混淆
        if not self.are_semantically_different(w1, w2):
            return False, 0.0

        # 特殊模式加分
        bonus_score = 0

        # 1. 单字母差异（最容易混淆）
        if self._is_single_letter_difference(w1, w2):
            bonus_score += 0.2

        # 2. 字母顺序差异
        if self._is_letter_order_difference(w1, w2):
            bonus_score += 0.15

        # 3. 双字母差异（如 affect/effect）
        if self._is_double_letter_difference(w1, w2):
            bonus_score += 0.1

        # 4. 前缀后缀混淆
        if self._has_prefix_suffix_confusion(w1, w2):
            bonus_score += 0.1

        final_score = min(1.0, similarity + bonus_score)

        # 只保留高质量的易混淆词对
        return final_score >= 0.75, final_score

    def _is_single_letter_difference(self, w1: str, w2: str) -> bool:
        """检查是否只有一个字母不同"""
        if len(w1) != len(w2):
            return False

        diff_count = sum(c1 != c2 for c1, c2 in zip(w1, w2))
        return diff_count == 1

    def _is_letter_order_difference(self, w1: str, w2: str) -> bool:
        """检查是否是字母顺序差异（如 angel/angle）"""
        return sorted(w1) == sorted(w2) and w1 != w2

    def _is_double_letter_difference(self, w1: str, w2: str) -> bool:
        """检查是否是双字母差异"""
        if len(w1) != len(w2):
            return False

        diff_count = sum(c1 != c2 for c1, c2 in zip(w1, w2))
        return diff_count == 2

    def _has_prefix_suffix_confusion(self, w1: str, w2: str) -> bool:
        """检查前缀后缀混淆"""
        common_confusions = [
            ("in", "un"),
            ("dis", "mis"),
            ("pre", "pro"),
            ("able", "ible"),
            ("ance", "ence"),
            ("tion", "sion"),
        ]

        for prefix1, prefix2 in common_confusions:
            if (
                w1.startswith(prefix1)
                and w2.startswith(prefix2)
                and w1[len(prefix1) :] == w2[len(prefix2) :]
            ):
                return True
            if (
                w1.endswith(prefix1)
                and w2.endswith(prefix2)
                and w1[: -len(prefix1)] == w2[: -len(prefix2)]
            ):
                return True

        return False

    def generate_relations(self) -> None:
        """生成易混淆词关系"""
        logger.info("开始生成精确易混淆关系...")

        with get_session() as session:
            words = session.query(Word).all()
            # 过滤掉太短的词
            words = [w for w in words if len(w.word) >= self.min_length]
            logger.info(f"过滤后单词数: {len(words)}")

            relations_to_add = []
            total_found = 0
            total_processed = 0

            for i, w1 in enumerate(words):
                if i % 100 == 0:
                    logger.info(f"已处理 {i}/{len(words)} 个单词，找到 {total_found} 个关系")

                for j in range(i + 1, len(words)):
                    w2 = words[j]
                    total_processed += 1

                    is_confused, score = self.calculate_confusion_score(
                        w1.word, w2.word
                    )

                    if is_confused:
                        pair_key = (w1.id, w2.id)
                        if pair_key not in self.processed_pairs:
                            self.processed_pairs.add(pair_key)
                            total_found += 1

                            relations_to_add.append(
                                WordRelation(
                                    word_id=w1.id,
                                    related_word_id=w2.id,
                                    relation_type=RelationType.confused,
                                    confidence=score,
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
                f"精确易混淆关系生成完成！处理了 {total_processed} 个词对，" f"生成了 {total_found} 个高质量关系"
            )


def generate_confused_relations(
    min_length: int = 4, similarity_threshold: float = 0.75
):
    """生成易混淆关系的入口函数"""
    generator = ConfusedWordsGenerator(min_length=min_length)
    generator.generate_relations()
