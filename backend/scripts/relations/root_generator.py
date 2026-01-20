# -*- coding: utf-8 -*-
"""
词根关系生成器

基于拉丁/希腊词根和词干分析识别同源词。
"""
from typing import Tuple, Set, Dict, List
import re

from .base import BaseGenerator, GenerationResult, ProgressPrinter, print_section, print_stat
from .data import COMMON_PREFIXES, LATIN_GREEK_ROOTS, ROOT_BLACKLIST

try:
    from nltk.stem import PorterStemmer
    stemmer = PorterStemmer()
    NLTK_AVAILABLE = True
except ImportError:
    stemmer = None
    NLTK_AVAILABLE = False


class RootGenerator(BaseGenerator):
    """词根关系生成器"""

    relation_type = "root"

    def __init__(self, min_confidence: float = 0.75):
        super().__init__()
        self.min_confidence = min_confidence
        self._stem_cache: Dict[str, str] = {}
        self._latin_root_cache: Dict[str, Set[str]] = {}

    def _remove_prefixes(self, word: str) -> str:
        """移除常见前缀"""
        for prefix in sorted(COMMON_PREFIXES.keys(), key=len, reverse=True):
            if word.startswith(prefix) and len(word) > len(prefix) + 2:
                return word[len(prefix):]
        return word

    def _has_other_root_after(self, word: str, current_root: str) -> bool:
        """检查词根后面是否还有另一个词根"""
        root_pos = word.find(current_root)
        if root_pos == -1:
            return False

        after_root = word[root_pos + len(current_root):]
        if len(after_root) < 3:
            return False

        for other_root in LATIN_GREEK_ROOTS.keys():
            if other_root == current_root or len(other_root) < 4:
                continue
            if other_root in after_root:
                return True

        return False

    def _validate_root_match(self, word: str, root: str, root_info: dict) -> bool:
        """验证词根匹配的有效性"""
        # 检查黑名单
        if root in ROOT_BLACKLIST and word in ROOT_BLACKLIST[root]:
            return False

        examples = [ex.lower() for ex in root_info["examples"]]
        if word in examples:
            return True

        root_pos = word.find(root)
        if root_pos == -1 or len(root) < 4:
            return False

        # 词根在开头
        if root_pos == 0:
            after_root = word[len(root):]
            if len(after_root) >= 2:
                if self._has_other_root_after(word, root):
                    return False
                return True
            return False

        # 词根前面是常见前缀
        prefix_before_root = word[:root_pos]
        if prefix_before_root in COMMON_PREFIXES:
            after_root = word[root_pos + len(root):]
            if len(after_root) >= 1:
                return True

        # 只允许非常短的前缀
        if 1 <= len(prefix_before_root) <= 2:
            if prefix_before_root in ["a", "e", "i", "o", "u", "de", "re", "un", "in"]:
                after_root = word[root_pos + len(root):]
                if len(after_root) >= 1:
                    return True

        return False

    def extract_latin_greek_roots(self, word: str) -> Set[str]:
        """提取单词中的拉丁/希腊词根"""
        word_lower = word.lower()

        if word_lower in self._latin_root_cache:
            return self._latin_root_cache[word_lower]

        found_roots = set()
        word_without_prefix = self._remove_prefixes(word_lower)

        for root, root_info in LATIN_GREEK_ROOTS.items():
            if root in word_without_prefix or root in word_lower:
                if self._validate_root_match(word_lower, root, root_info):
                    found_roots.add(root)
                    continue

            variants = root_info.get("variants", [])
            for variant in variants:
                if variant in word_without_prefix or variant in word_lower:
                    if self._validate_root_match(word_lower, variant, root_info):
                        found_roots.add(root)
                        break

        self._latin_root_cache[word_lower] = found_roots
        return found_roots

    def get_stem(self, word: str) -> str:
        """获取词干"""
        word_lower = word.lower()
        if word_lower in self._stem_cache:
            return self._stem_cache[word_lower]

        if NLTK_AVAILABLE and stemmer:
            stem = stemmer.stem(word_lower)
        else:
            # 简单的后缀移除
            stem = word_lower
            suffixes = ['ing', 'ed', 'er', 'est', 'ly', 's', 'es']
            for suffix in suffixes:
                if stem.endswith(suffix) and len(stem) > len(suffix) + 2:
                    stem = stem[:-len(suffix)]
                    break

        self._stem_cache[word_lower] = stem
        return stem

    def _roots_similar(self, root1: str, root2: str) -> bool:
        """检查两个词根是否相似"""
        if root1 == root2:
            return True

        if len(root1) >= 4 and len(root2) >= 4:
            if len(root1) == len(root2) + 1 and root1[:-1] == root2:
                return True
            if len(root2) == len(root1) + 1 and root2[:-1] == root1:
                return True
            if len(root1) == len(root2) and root1[:-2] == root2[:-2] and len(root1) >= 5:
                return True

        return False

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
                root1, root2 = match1.group(1), match2.group(1)
                if self._roots_similar(root1, root2):
                    return True

            match1 = re.match(pattern2, word1)
            match2 = re.match(pattern1, word2)

            if match1 and match2:
                root1, root2 = match1.group(1), match2.group(1)
                if self._roots_similar(root1, root2):
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
            confidence = 0.85 + (0.1 if len(common_roots) > 1 else 0)
            return True, min(1.0, confidence)

        # 检查词干匹配
        stem1, stem2 = self.get_stem(w1_lower), self.get_stem(w2_lower)
        if stem1 == stem2 and len(stem1) >= 5:
            if self._is_derivational_pair(w1_lower, w2_lower):
                return True, 0.80

        return False, 0.0

    def generate(
        self,
        words: List[Dict],
        word_index: Dict[str, int],
        existing_relations: Set[Tuple[int, int, str]],
        processed_word_ids: Set[int]
    ) -> GenerationResult:
        """生成词根关系"""

        # 过滤未处理的单词
        unprocessed = [w for w in words if w['id'] not in processed_word_ids]

        print_section(f"词根关系生成 (root)")
        print_stat("总单词数", len(words))
        print_stat("待处理", len(unprocessed))
        print_stat("已知词根数", len(LATIN_GREEK_ROOTS))
        print_stat("最小置信度", self.min_confidence)

        if not unprocessed:
            print("\n   ✓ 所有单词已处理完毕")
            return GenerationResult(relations=[], logs=[], stats={'skipped': True})

        new_relations = []
        new_logs = []
        total_found = 0
        skipped_existing = 0
        stats_by_method = {'latin_greek': 0, 'stem': 0}

        # 阶段1: 预计算词根缓存
        print(f"\n   📊 阶段1: 预计算词根...")
        progress = ProgressPrinter(len(words))
        for i, word in enumerate(words):
            self.extract_latin_greek_roots(word["word"])
            self.get_stem(word["word"])
            progress.update(i + 1, f"缓存: {word['word']}")
        progress.finish("词根缓存完成")

        # 阶段2: 比较词对
        print(f"\n   🔗 阶段2: 比较词对...")
        # 只需要比较未处理的词与所有词
        total_comparisons = len(unprocessed) * len(words)
        progress = ProgressPrinter(len(unprocessed))

        for i, w1 in enumerate(unprocessed):
            found_count = 0

            for w2 in words:
                if w1['id'] >= w2['id']:  # 避免重复比较
                    continue

                same_root, confidence = self.are_same_root(w1["word"], w2["word"])

                if same_root and confidence >= self.min_confidence:
                    if self._add_relation(w1['id'], w2['id'], confidence, new_relations, existing_relations):
                        found_count += 1
                        total_found += 1
                        # 统计方法
                        roots1 = self.extract_latin_greek_roots(w1["word"])
                        roots2 = self.extract_latin_greek_roots(w2["word"])
                        if roots1 & roots2:
                            stats_by_method['latin_greek'] += 1
                        else:
                            stats_by_method['stem'] += 1
                    else:
                        skipped_existing += 1

            new_logs.append(self._create_log(w1['id'], found_count))
            progress.update(i + 1, f"{w1['word']}: +{found_count}")

        progress.finish(f"找到 {total_found} 对同源词")

        # 统计
        stats = {
            'total_found': total_found,
            'skipped_existing': skipped_existing,
            'by_method': stats_by_method,
            'processed_count': len(unprocessed)
        }

        print(f"\n   ✅ 词根关系生成完成")
        print_stat("新增关系", f"{len(new_relations)} 条（双向）")
        print_stat("拉丁/希腊词根", stats_by_method['latin_greek'])
        print_stat("词干匹配", stats_by_method['stem'])
        print_stat("跳过已存在", skipped_existing)

        return GenerationResult(relations=new_relations, logs=new_logs, stats=stats)
