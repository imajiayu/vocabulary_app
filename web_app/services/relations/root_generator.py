# -*- coding: utf-8 -*-
"""
改进的词根关系生成器 v2
基于验证集优化的版本
"""
from typing import Tuple, Set, Dict, List
from nltk.stem import PorterStemmer
from web_app.models.word import WordRelation, RelationType
from web_app.services.relations.data import (
    COMMON_PREFIXES,
    LATIN_GREEK_ROOTS,
    ROOT_BLACKLIST,
)
from web_app.database.relation_dao import (
    db_get_all_words,
    db_batch_insert_relations,
    db_batch_check_relations_exist,
    db_get_unprocessed_word_ids,
    db_mark_words_processed
)
import re

stemmer = PorterStemmer()


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


class RootRelationGenerator:
    """改进的词根关系生成器（v2优化版）"""

    def __init__(self, min_confidence: float = 0.75):
        self.min_confidence = min_confidence
        self._stem_cache: Dict[str, str] = {}
        self._latin_root_cache: Dict[str, Set[str]] = {}

    def extract_latin_greek_roots(self, word: str) -> Set[str]:
        """提取单词中的拉丁/希腊词根"""
        word_lower = word.lower()

        if word_lower in self._latin_root_cache:
            return self._latin_root_cache[word_lower]

        found_roots = set()
        word_without_prefix = self._remove_prefixes(word_lower)

        # 检查每个已知词根
        for root, root_info in LATIN_GREEK_ROOTS.items():
            # 检查词根本身
            if root in word_without_prefix or root in word_lower:
                if self._validate_root_match(word_lower, root, root_info):
                    found_roots.add(root)
                    continue

            # 检查词根变形
            variants = root_info.get("variants", [])
            for variant in variants:
                if variant in word_without_prefix or variant in word_lower:
                    if self._validate_root_match(word_lower, variant, root_info):
                        found_roots.add(root)
                        break

        self._latin_root_cache[word_lower] = found_roots
        return found_roots

    def _remove_prefixes(self, word: str) -> str:
        """移除常见前缀"""
        for prefix in sorted(COMMON_PREFIXES.keys(), key=len, reverse=True):
            if word.startswith(prefix) and len(word) > len(prefix) + 2:
                return word[len(prefix) :]
        return word

    def _validate_root_match(self, word: str, root: str, root_info: dict) -> bool:
        """验证词根匹配的有效性（更严格）"""
        # 检查黑名单
        if root in ROOT_BLACKLIST:
            if word in ROOT_BLACKLIST[root]:
                return False

        examples = [ex.lower() for ex in root_info["examples"]]
        if word in examples:
            return True

        root_pos = word.find(root)
        if root_pos == -1:
            return False

        # 词根至少4个字母（避免过短匹配）
        if len(root) < 4:
            return False

        # 词根在开头
        if root_pos == 0:
            # 确保词根后面有后缀或合理的结尾
            after_root = word[len(root) :]
            if len(after_root) >= 2:
                # 额外检查：词根后面不应该是另一个完整的词根
                # 例如：anticipate = anti + cipate，cipate本身是词根
                # 这种情况下anti不是真正的词根
                if self._has_other_root_after(word, root):
                    return False
                return True
            return False

        # 词根前面是常见前缀
        prefix_before_root = word[:root_pos]
        if prefix_before_root in COMMON_PREFIXES:
            # 确保词根后面也有合理的部分
            after_root = word[root_pos + len(root) :]
            if len(after_root) >= 1:
                return True

        # 只允许非常短的前缀（1-2个字母）
        if 1 <= len(prefix_before_root) <= 2:
            # 而且前缀必须是常见的单字母前缀
            if prefix_before_root in ["a", "e", "i", "o", "u", "de", "re", "un", "in"]:
                after_root = word[root_pos + len(root) :]
                if len(after_root) >= 1:
                    return True

        return False

    def _has_other_root_after(self, word: str, current_root: str) -> bool:
        """检查词根后面是否还有另一个词根（说明当前词根可能不是真正的词根）"""
        root_pos = word.find(current_root)
        if root_pos == -1:
            return False

        after_root = word[root_pos + len(current_root) :]
        if len(after_root) < 3:
            return False

        # 检查after_root是否包含其他已知的词根
        for other_root in LATIN_GREEK_ROOTS.keys():
            if other_root == current_root:
                continue
            if len(other_root) < 4:  # 只检查长度足够的词根
                continue
            if other_root in after_root:
                # 找到了另一个词根，说明当前词根可能只是巧合
                # 例如：anticipate中，anti后面有cipat词根
                return True

        return False

    def are_same_root(self, w1: str, w2: str) -> Tuple[bool, float]:
        """判断两个词是否有相同词根"""
        w1_lower, w2_lower = w1.lower(), w2.lower()

        if w1_lower == w2_lower:
            return False, 0.0

        # 检查拉丁/希腊词根关系
        roots1 = self.extract_latin_greek_roots(w1_lower)
        roots2 = self.extract_latin_greek_roots(w2_lower)

        common_roots = roots1 & roots2
        if common_roots:
            # 基础置信度
            confidence = 0.85

            # 多个共同词根
            if len(common_roots) > 1:
                confidence += 0.1

            return True, min(1.0, confidence)

        # 检查词干匹配（作为补充）
        stem1, stem2 = self.get_stem(w1_lower), self.get_stem(w2_lower)
        if stem1 == stem2 and len(stem1) >= 5:
            # 必须验证是真正的派生关系
            if self._is_derivational_pair(w1_lower, w2_lower):
                return True, 0.80

        return False, 0.0

    def get_stem(self, word: str) -> str:
        """获取词干"""
        word_lower = word.lower()
        if word_lower in self._stem_cache:
            return self._stem_cache[word_lower]

        stem = stemmer.stem(word_lower)
        self._stem_cache[word_lower] = stem
        return stem

    def _is_derivational_pair(self, word1: str, word2: str) -> bool:
        """检查是否是明确的派生词对"""
        derivation_patterns = [
            (r"(.+)ly$", r"(.+)$"),
            (r"(.+)ness$", r"(.+)$"),
            (r"(.+)ment$", r"(.+)$"),
            (r"(.+)tion$", r"(.+)t?e?$"),
            (r"(.+)able$", r"(.+)$"),
            (r"(.+)ful$", r"(.+)$"),
            (r"(.+)ity$", r"(.+)$"),
            (r"(.+)ive$", r"(.+)$"),
            (r"(.+)ing$", r"(.+)$"),
            (r"(.+)ed$", r"(.+)$"),
        ]

        for pattern1, pattern2 in derivation_patterns:
            match1 = re.match(pattern1, word1)
            match2 = re.match(pattern2, word2)

            if match1 and match2:
                root1 = match1.group(1)
                root2 = match2.group(1)
                if self._roots_similar(root1, root2):
                    return True

            # 反向检查
            match1 = re.match(pattern2, word1)
            match2 = re.match(pattern1, word2)

            if match1 and match2:
                root1 = match1.group(1)
                root2 = match2.group(1)
                if self._roots_similar(root1, root2):
                    return True

        return False

    def _roots_similar(self, root1: str, root2: str) -> bool:
        """检查两个词根是否相似"""
        if root1 == root2:
            return True

        if len(root1) >= 4 and len(root2) >= 4:
            # 允许结尾字母的脱落
            if len(root1) == len(root2) + 1 and root1[:-1] == root2:
                return True
            if len(root2) == len(root1) + 1 and root2[:-1] == root1:
                return True

            # 允许双字母结尾的变化
            if (
                len(root1) == len(root2)
                and root1[:-2] == root2[:-2]
                and len(root1) >= 5
            ):
                return True

        return False

    def generate_relations_for_words(
        self, words: List[str]
    ) -> List[Tuple[str, str, float]]:
        """为给定的单词列表生成词根关系"""
        relations = []

        for i, w1 in enumerate(words):
            for j in range(i + 1, len(words)):
                w2 = words[j]
                same_root, confidence = self.are_same_root(w1, w2)

                if same_root and confidence >= self.min_confidence:
                    relations.append((w1, w2, confidence))

        return relations

    def _process_word_batch(
        self, word_pairs: List[Tuple[Dict, Dict]]
    ) -> List[WordRelation]:
        """处理词对批次的辅助方法"""
        relations = []
        processed_pairs: Set[Tuple[int, int]] = set()

        for w1, w2 in word_pairs:
            pair_key = tuple(sorted([w1["id"], w2["id"]]))
            if pair_key in processed_pairs:
                continue

            same_root, confidence = self.are_same_root(w1["word"], w2["word"])
            if same_root and confidence >= self.min_confidence:
                processed_pairs.add(pair_key)
                relations.append(
                    WordRelation(
                        word_id=w1["id"],
                        related_word_id=w2["id"],
                        relation_type=RelationType.root,
                        confidence=confidence,
                    )
                )
        return relations

    def generate_relations(self, emitter=None) -> int:
        """生成所有词根关系并插入数据库（自动增量模式）

        只处理未在日志表中的单词，已处理的单词会自动跳过。
        如需重新生成，请先调用 db_clear_relations(['root'])

        参数:
        - emitter: 进度发射器
        """
        all_words = db_get_all_words()

        # 自动增量：只处理未处理的单词
        unprocessed_ids = db_get_unprocessed_word_ids(RelationType.root)
        words_data = [w for w in all_words if w['id'] in unprocessed_ids]

        if emitter:
            emitter.emit_progress(
                0, len(words_data),
                f"Processing {len(words_data)} unprocessed words"
            )

        total_words = len(words_data)

        # 预计算所有词的缓存以提高速度
        for i, word in enumerate(words_data):
            if emitter and i % 500 == 0:
                emitter.emit_progress(
                    i, total_words, f"Pre-computing word roots: {i}/{total_words}"
                )
            # 预计算词根
            self.extract_latin_greek_roots(word["word"])
            self.get_stem(word["word"])

        relations_to_add = []
        relations_to_check = []
        total_found = 0
        skipped_count = 0

        # 分批处理词对
        batch_size = 1000
        word_pairs = []

        for i, w1 in enumerate(words_data):
            if emitter and i % 100 == 0:
                # 计算当前发现和插入的总数（包括待处理的）
                current_found = total_found + len(relations_to_check)
                current_inserted = total_found - skipped_count
                emitter.emit_progress(
                    i,
                    total_words,
                    f"Processing root relations: {i}/{total_words} words, found {current_found}, inserted {current_inserted}",
                )

            for j in range(i + 1, total_words):
                w2 = words_data[j]
                word_pairs.append((w1, w2))

                # 当收集够一批词对时处理
                if len(word_pairs) >= batch_size:
                    batch_relations = self._process_word_batch(word_pairs)
                    relations_to_check.extend([
                        {
                            'word_id': rel.word_id,
                            'related_word_id': rel.related_word_id,
                            'relation_type': rel.relation_type,
                            'confidence': rel.confidence
                        }
                        for rel in batch_relations
                    ])
                    word_pairs = []

                    # 批量检查和插入数据库
                    if len(relations_to_check) >= 2000:
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
                            current_inserted = total_found - skipped_count
                            emitter.emit_progress(
                                i,
                                total_words,
                                f"Processing root relations: {i}/{total_words} words, found {total_found}, inserted {current_inserted}",
                            )

                        relations_to_add = []
                        relations_to_check = []

        # 处理剩余的词对
        if word_pairs:
            batch_relations = self._process_word_batch(word_pairs)
            relations_to_check.extend([
                {
                    'word_id': rel.word_id,
                    'related_word_id': rel.related_word_id,
                    'relation_type': rel.relation_type,
                    'confidence': rel.confidence
                }
                for rel in batch_relations
            ])

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
            RelationType.root
        )

        if emitter:
            emitter.emit_progress(
                total_words,
                total_words,
                f"Completed! Added {total_found}, skipped {skipped_count} existing",
            )

        return total_found


def generate_validation_results(output_file: str = "validation_results_v2.json"):
    """在验证集上生成词根关系结果"""
    import json

    # 读取验证集单词
    with open("validation_words.txt", "r") as f:
        words = [line.strip() for line in f if line.strip()]

    print(f"读取验证集: {len(words)} 个单词")

    # 生成关系
    generator = RootRelationGenerator(min_confidence=0.75)
    relations = generator.generate_relations_for_words(words)

    print(f"生成关系: {len(relations)} 对")

    # 转换为clusters格式（方便比较）
    word_to_cluster = {}
    clusters = []

    for w1, w2, confidence in relations:
        # 找到或创建cluster
        cluster1 = word_to_cluster.get(w1)
        cluster2 = word_to_cluster.get(w2)

        if cluster1 is not None and cluster2 is not None:
            if cluster1 != cluster2:
                # 合并两个cluster
                clusters[cluster1]["words"].extend(clusters[cluster2]["words"])
                clusters[cluster1]["words"] = list(set(clusters[cluster1]["words"]))
                # 更新cluster2中所有词的映射
                for word in clusters[cluster2]["words"]:
                    word_to_cluster[word] = cluster1
                clusters[cluster2] = None  # 标记为已合并
        elif cluster1 is not None:
            clusters[cluster1]["words"].append(w2)
            clusters[cluster1]["words"] = list(set(clusters[cluster1]["words"]))
            word_to_cluster[w2] = cluster1
        elif cluster2 is not None:
            clusters[cluster2]["words"].append(w1)
            clusters[cluster2]["words"] = list(set(clusters[cluster2]["words"]))
            word_to_cluster[w1] = cluster2
        else:
            # 创建新cluster
            roots1 = generator.extract_latin_greek_roots(w1)
            roots2 = generator.extract_latin_greek_roots(w2)
            common_roots = roots1 & roots2
            root_name = list(common_roots)[0] if common_roots else f"{w1}/{w2}"

            new_cluster = {"root": root_name, "words": [w1, w2]}
            clusters.append(new_cluster)
            cluster_idx = len(clusters) - 1
            word_to_cluster[w1] = cluster_idx
            word_to_cluster[w2] = cluster_idx

    # 过滤掉被合并的cluster
    clusters = [c for c in clusters if c is not None]

    # 保存结果
    result = {
        "relations": [
            {"word1": w1, "word2": w2, "confidence": conf} for w1, w2, conf in relations
        ],
        "clusters": clusters,
        "total_relations": len(relations),
        "total_clusters": len(clusters),
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\n结果已保存到: {output_file}")
    print(f"总关系数: {len(relations)}")
    print(f"总cluster数: {len(clusters)}")

    return result


def generate_root_relations(emitter=None):
    """生成词根关系的顶层函数（向后兼容）"""
    generator = RootRelationGenerator(min_confidence=0.75)
    return generator.generate_relations(emitter=emitter)


if __name__ == "__main__":
    generate_validation_results()
