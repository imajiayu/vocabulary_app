# -*- coding: utf-8 -*-
from typing import Tuple, Set, Dict, List
from functools import lru_cache
from concurrent.futures import ThreadPoolExecutor, as_completed
import multiprocessing
from nltk.corpus import wordnet
from nltk.stem import PorterStemmer
from gensim.models import KeyedVectors
from web_app.models.word import Word, WordRelation, RelationType
from web_app.extensions import get_session
from sqlalchemy import insert
from web_app.services.relations.utils import batch_insert_relations

stemmer = PorterStemmer()

# 拉丁/希腊词根数据库（针对GRE词汇）
LATIN_GREEK_ROOTS = {
    # 说话/声音相关
    "dict": {
        "meaning": "say, speak",
        "examples": [
            "indict",
            "vindicate",
            "valediction",
            "dictate",
            "predict",
            "contradict",
        ],
        "variants": ["dicat", "dic"],
    },
    "loqu": {
        "meaning": "speak",
        "examples": ["loquacious", "grandiloquent", "obloquy", "soliloquy", "eloquent"],
        "variants": ["locut"],
    },
    "log": {
        "meaning": "speak, word",
        "examples": ["monologue", "prologue", "dialogue", "eulogy", "apology"],
        "variants": ["logu"],
    },
    "voc": {
        "meaning": "call, voice",
        "examples": ["advocate", "vocation", "vociferous", "equivocate", "provocative"],
        "variants": ["vocat", "vok"],
    },
    "vok": {
        "meaning": "call",
        "examples": ["provoke", "revoke", "convoke", "invoke", "evoke"],
        "variants": ["vocat", "voc"],
    },
    "claim": {
        "meaning": "shout, call",
        "examples": ["claim", "disclaim", "declaim", "exclaim", "proclaim"],
        "variants": ["clam"],
    },
    "clam": {
        "meaning": "shout",
        "examples": ["clamor", "clamorous", "acclamation"],
        "variants": ["claim"],
    },
    "verb": {
        "meaning": "word",
        "examples": ["verbose", "verbatim", "reverberate", "verbal", "proverb"],
        "variants": ["verber"],
    },
    "son": {
        "meaning": "sound",
        "examples": ["consonant", "dissonance", "resonant", "sonorous", "unison"],
        "variants": ["sonan"],
    },
    "phon": {
        "meaning": "sound",
        "examples": ["cacophony", "euphonious", "symphony", "telephone"],
        "variants": ["phonic"],
    },
    # 行动相关
    "gat": {
        "meaning": "ask, gather",
        "examples": ["interrogate", "abrogate", "surrogate", "derogatory"],
        "variants": ["grog", "rog"],
    },
    "rog": {
        "meaning": "ask",
        "examples": ["prerogative", "interrogate", "arrogant", "derogate"],
        "variants": ["gat", "grog"],
    },
    "nunc": {
        "meaning": "announce",
        "examples": ["denounce", "renounce", "enunciate", "announce", "pronunciation"],
        "variants": ["nounc", "nounce"],
    },
    "nount": {
        "meaning": "announce",
        "examples": ["pronouncement"],
        "variants": ["nounc"],
    },
    # 知识/感知相关
    "gno": {
        "meaning": "know",
        "examples": ["agnostic", "diagnostic", "prognosis", "cognition"],
    },
    "sci": {
        "meaning": "know",
        "examples": ["science", "conscience", "omniscient", "prescient"],
    },
    "vid": {"meaning": "see", "examples": ["video", "evident", "provide", "divide"]},
    "vis": {
        "meaning": "see",
        "examples": ["visible", "vision", "supervise", "revision"],
    },
    "spec": {
        "meaning": "look, see",
        "examples": ["inspect", "respect", "prospect", "retrospect"],
    },
    "spect": {
        "meaning": "look",
        "examples": ["spectacle", "perspective", "circumspect"],
    },
    # 感情/品质相关
    "fam": {
        "meaning": "fame, reputation",
        "examples": ["famous", "infamous", "defamation"],
    },
    "fab": {
        "meaning": "speak",
        "examples": ["fable", "affable", "ineffable", "fabulous"],
    },
    "am": {"meaning": "love", "examples": ["amiable", "amorous", "amateur", "amity"]},
    "phil": {
        "meaning": "love",
        "examples": ["philosophy", "philanthropist", "bibliophile"],
    },
    # 力量/统治相关
    "pot": {
        "meaning": "power",
        "examples": ["potential", "potent", "impotent", "omnipotent"],
    },
    "puls": {
        "meaning": "drive, push",
        "examples": ["compulsive", "repulsive", "impulse", "expulsion"],
    },
    "pel": {
        "meaning": "drive, push",
        "examples": ["compel", "repel", "expel", "impel"],
    },
    # 时间/变化相关
    "mut": {
        "meaning": "change",
        "examples": ["mutable", "immutable", "mutation", "commute"],
    },
    "vers": {
        "meaning": "turn",
        "examples": ["diverse", "reverse", "adverse", "versatile"],
    },
    "vert": {"meaning": "turn", "examples": ["convert", "divert", "revert", "subvert"]},
    "flu": {
        "meaning": "flow",
        "examples": ["fluid", "fluent", "influence", "affluent"],
    },
    "flux": {"meaning": "flow", "examples": ["flux", "influx", "reflux"]},
    # 位置/移动相关
    "loc": {
        "meaning": "place",
        "examples": ["locate", "allocate", "dislocate", "locale"],
    },
    "pos": {
        "meaning": "place, put",
        "examples": ["position", "dispose", "compose", "impose"],
    },
    "pon": {"meaning": "put, place", "examples": ["component", "exponent", "postpone"]},
    "mit": {"meaning": "send", "examples": ["transmit", "admit", "emit", "permit"]},
    "miss": {
        "meaning": "send",
        "examples": ["missile", "mission", "dismiss", "remiss"],
    },
}

# 常见前缀
COMMON_PREFIXES = {
    "ab": "away, from",
    "ad": "to, toward",
    "ante": "before",
    "anti": "against",
    "auto": "self",
    "circum": "around",
    "con": "with, together",
    "contra": "against",
    "de": "away, down",
    "dis": "apart, not",
    "ex": "out, from",
    "in": "in, not",
    "inter": "between",
    "intra": "within",
    "pre": "before",
    "pro": "forward, for",
    "re": "back, again",
    "retro": "backward",
    "sub": "under",
    "super": "above",
    "trans": "across",
    "ultra": "beyond",
}

DERIVATIONAL_SUFFIXES = {
    # 名词后缀
    "tion": ("action", "state", "condition"),
    "sion": ("action", "state", "condition"),
    "ment": ("result", "action", "state"),
    "ness": ("quality", "state"),
    "ity": ("quality", "state"),
    "ism": ("doctrine", "state", "condition"),
    "ist": ("person", "agent"),
    "er": ("agent", "person"),
    "or": ("agent", "person"),
    "ary": ("place", "thing"),
    "ory": ("place", "thing"),
    "age": ("collection", "action"),
    "ship": ("state", "skill"),
    "hood": ("state", "condition"),
    "dom": ("state", "condition"),
    # 形容词后缀
    "able": ("capable", "worthy"),
    "ible": ("capable", "worthy"),
    "ful": ("full of", "characterized by"),
    "less": ("without", "lacking"),
    "ous": ("characterized by", "full of"),
    "ious": ("characterized by", "full of"),
    "eous": ("characterized by", "full of"),
    "ive": ("tending to", "characterized by"),
    "ative": ("tending to", "characterized by"),
    "al": ("relating to", "characterized by"),
    "ic": ("relating to", "characterized by"),
    "ical": ("relating to", "characterized by"),
    "ary": ("relating to", "characterized by"),
    "ory": ("relating to", "characterized by"),
    "ent": ("characterized by", "tending to"),
    "ant": ("characterized by", "tending to"),
    # 动词后缀
    "ize": ("make", "cause to become"),
    "ise": ("make", "cause to become"),
    "ify": ("make", "cause to become"),
    "ate": ("make", "cause to become"),
    "en": ("make", "cause to become"),
    # 副词后缀
    "ly": ("in manner of", "to degree"),
    "ward": ("in direction of"),
    "wise": ("in manner of"),
}

# 这里示例用 gensim 加载词向量
# 你需要提前下载好 fasttext / word2vec 模型
# model = KeyedVectors.load_word2vec_format("path/to/fasttext.vec")
model = None  # 如果没有模型，可先不启用向量验证


class RootRelationGenerator:
    """基于WordNet的词根关系生成器 - 优化版"""

    def __init__(
        self,
        min_confidence: float = 0.8,
        vector_threshold: float = 0.65,
        use_multiprocessing: bool = True,
    ):
        self.min_confidence = min_confidence
        self.vector_threshold = vector_threshold
        self.processed_pairs: Set[Tuple[int, int]] = set()
        self.use_multiprocessing = use_multiprocessing

        # 预计算缓存
        self._wordnet_cache: Dict[str, Dict[str, float]] = {}
        self._stem_cache: Dict[str, str] = {}
        self._morphological_cache: Dict[str, Dict[str, float]] = {}
        self._latin_root_cache: Dict[str, Set[str]] = {}

        # 负缓存 - 记录确定不相关的词对
        self._negative_cache: Set[Tuple[str, str]] = set()

    def get_wordnet_derivations(self, word: str) -> Dict[str, float]:
        """使用WordNet获取派生词关系 - 严格筛选版"""
        word_lower = word.lower()

        # 检查缓存
        if word_lower in self._wordnet_cache:
            return self._wordnet_cache[word_lower]

        derivations = {}

        try:
            synsets = wordnet.synsets(word_lower)
            if not synsets:
                self._wordnet_cache[word_lower] = derivations
                return derivations

            for synset in synsets:
                # 只获取真正的形态派生关系
                for lemma in synset.lemmas():
                    try:
                        for related_lemma in lemma.derivationally_related_forms():
                            related_word = (
                                related_lemma.name().lower().replace("_", " ")
                            )
                            if related_word != word_lower and len(related_word) > 2:
                                # 严格的词根验证
                                if self._is_true_derivational_pair(
                                    word_lower, related_word
                                ):
                                    confidence = 0.95
                                    if synset.pos() != related_lemma.synset().pos():
                                        confidence = 1.0  # 跨词性派生更可靠

                                    if related_word in derivations:
                                        derivations[related_word] = max(
                                            derivations[related_word], confidence
                                        )
                                    else:
                                        derivations[related_word] = confidence
                    except:
                        continue

                # 只保留可靠的Pertainyms
                for lemma in synset.lemmas():
                    try:
                        for pertainym in lemma.pertainyms():
                            related_word = pertainym.name().lower().replace("_", " ")
                            if related_word != word_lower and len(related_word) > 2:
                                # 验证是否真正相关
                                if self._is_true_derivational_pair(
                                    word_lower, related_word
                                ):
                                    confidence = 0.9
                                    if related_word in derivations:
                                        derivations[related_word] = max(
                                            derivations[related_word], confidence
                                        )
                                    else:
                                        derivations[related_word] = confidence
                    except:
                        continue

        except Exception as e:
            pass

        # 缓存结果
        self._wordnet_cache[word_lower] = derivations
        return derivations

    def _is_true_derivational_pair(self, word1: str, word2: str) -> bool:
        """严格验证两个词是否真正是派生关系"""
        # 1. 必须有共同的词根（通过后缀分析）
        if not self._has_shared_root(word1, word2):
            return False

        # 2. 长度不能差异太大
        if abs(len(word1) - len(word2)) > 5:
            return False

        # 3. 检查是否符合常见的派生模式
        return self._matches_derivational_pattern(word1, word2)

    def _has_shared_root(self, word1: str, word2: str) -> bool:
        """检查两个词是否有共同词根"""
        # 获取可能的词根
        root1 = self._extract_root(word1)
        root2 = self._extract_root(word2)

        # 词根长度至少3个字符
        if len(root1) < 3 or len(root2) < 3:
            return False

        # 检查词根相似性
        return root1 == root2 or self._roots_similar(root1, root2)

    def _extract_root(self, word: str) -> str:
        """提取词根"""
        # 常见后缀及其优先级（越靠前优先级越高）
        suffixes = [
            "ation",
            "ition",
            "tion",
            "sion",
            "ment",
            "ness",
            "ity",
            "ism",
            "able",
            "ible",
            "ful",
            "less",
            "ous",
            "ious",
            "eous",
            "ive",
            "ative",
            "al",
            "ical",
            "ic",
            "ary",
            "ory",
            "ent",
            "ant",
            "ate",
            "ize",
            "ise",
            "ify",
            "en",
            "ly",
            "er",
            "or",
            "ist",
            "age",
            "ship",
            "hood",
            "dom",
        ]

        for suffix in suffixes:
            if word.endswith(suffix) and len(word) > len(suffix) + 2:
                return word[: -len(suffix)]

        return word

    def _roots_similar(self, root1: str, root2: str) -> bool:
        """检查两个词根是否相似（允许小的变化）"""
        if root1 == root2:
            return True

        # 只有在词根长度足够且相似度很高时才允许变化
        if len(root1) >= 4 and len(root2) >= 4:
            # 允许结尾字母的脱落（如create/creation中的e脱落）
            if len(root1) == len(root2) + 1 and root1[:-1] == root2:
                return True
            if len(root2) == len(root1) + 1 and root2[:-1] == root1:
                return True

            # 允许双字母结尾的变化 (如permit/permission中的t变化)
            if (
                len(root1) == len(root2)
                and root1[:-2] == root2[:-2]
                and len(root1) >= 5
            ):
                return True

        return False

    def _matches_derivational_pattern(self, word1: str, word2: str) -> bool:
        """检查是否符合派生模式"""
        import re

        # 检查常见的派生模式
        derivation_pairs = [
            # 动词 -> 名词
            (r"(.+)ate$", r"(.+)ation$"),
            (r"(.+)ify$", r"(.+)ification$"),
            (r"(.+)ize$", r"(.+)ization$"),
            (r"(.+)ise$", r"(.+)isation$"),
            # 形容词 -> 名词
            (r"(.+)able$", r"(.+)ability$"),
            (r"(.+)ible$", r"(.+)ibility$"),
            (r"(.+)ic$", r"(.+)icity$"),
            # 名词 -> 形容词
            (r"(.+)tion$", r"(.+)tive$"),
            (r"(.+)ment$", r"(.+)al$"),
            # 简单后缀添加
            (r"(.+)$", r"(.+)ly$"),
            (r"(.+)$", r"(.+)ness$"),
            (r"(.+)$", r"(.+)ful$"),
            (r"(.+)$", r"(.+)er$"),
            (r"(.+)$", r"(.+)ed$"),
            (r"(.+)$", r"(.+)ing$"),
        ]

        for pattern1, pattern2 in derivation_pairs:
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

    def get_stem(self, word: str) -> str:
        """获取词干 - 带缓存优化"""
        word_lower = word.lower()
        if word_lower in self._stem_cache:
            return self._stem_cache[word_lower]

        stem = stemmer.stem(word_lower)
        self._stem_cache[word_lower] = stem
        return stem

    def _has_morphological_similarity(self, word1: str, word2: str) -> bool:
        """检查两个词是否有形态相似性"""
        # 检查是否有共同词根（通过删除已知后缀）
        for suffix in DERIVATIONAL_SUFFIXES:
            if word1.endswith(suffix) and len(word1) > len(suffix) + 2:
                root1 = word1[: -len(suffix)]
                if word2.startswith(root1) or word2 == root1:
                    return True
            if word2.endswith(suffix) and len(word2) > len(suffix) + 2:
                root2 = word2[: -len(suffix)]
                if word1.startswith(root2) or word1 == root2:
                    return True
        return False

    def get_morphological_derivations(self, word: str) -> Dict[str, float]:
        """基于形态学规则获取派生词 - 带缓存优化"""
        word_lower = word.lower()

        # 检查缓存
        if word_lower in self._morphological_cache:
            return self._morphological_cache[word_lower]

        derivations = {}

        # 快速后缀检查 - 只检查最常见的后缀
        common_suffixes = [
            "tion",
            "sion",
            "ment",
            "ness",
            "ity",
            "able",
            "ible",
            "ful",
            "less",
            "ous",
            "ive",
            "al",
            "ly",
            "er",
            "or",
            "ist",
        ]

        for suffix in common_suffixes:
            if word_lower.endswith(suffix) and len(word_lower) > len(suffix) + 2:
                root = word_lower[: -len(suffix)]
                # 只生成最可能的派生形式
                if len(root) > 2:
                    derivations[root] = 0.8
                    # 添加最常见的交叉派生
                    if suffix in ["tion", "sion"]:
                        derivations[root + "al"] = 0.75
                        derivations[root + "ive"] = 0.75
                    elif suffix in ["able", "ible"]:
                        derivations[root + "ity"] = 0.75
                break  # 找到一个匹配就停止

        # 缓存结果
        self._morphological_cache[word_lower] = derivations
        return derivations

    def extract_latin_greek_roots(self, word: str) -> Set[str]:
        """提取单词中的拉丁/希腊词根"""
        word_lower = word.lower()

        # 检查缓存
        if word_lower in self._latin_root_cache:
            return self._latin_root_cache[word_lower]

        found_roots = set()

        # 去除常见前缀
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
                        found_roots.add(root)  # 添加原始词根，不是变形
                        break

        # 缓存结果
        self._latin_root_cache[word_lower] = found_roots
        return found_roots

    def _remove_prefixes(self, word: str) -> str:
        """移除常见前缀"""
        for prefix in sorted(COMMON_PREFIXES.keys(), key=len, reverse=True):
            if word.startswith(prefix) and len(word) > len(prefix) + 2:
                return word[len(prefix) :]
        return word

    def _validate_root_match(self, word: str, root: str, root_info: dict) -> bool:
        """验证词根匹配的有效性"""
        # 检查该词是否在已知例词中
        examples = [ex.lower() for ex in root_info["examples"]]
        if word in examples:
            return True

        # 检查词根在单词中的位置是否合理
        root_pos = word.find(root)
        if root_pos == -1:
            return False

        # 词根不能太短
        if len(root) < 3:
            return False

        # 更灵活的词根验证 - 允许词根在单词的不同位置
        # 1. 词根在开头（如 dict-ate）
        if root_pos == 0:
            return True

        # 2. 词根在中间，但前面是常见前缀
        prefix_before_root = word[:root_pos]
        if prefix_before_root in COMMON_PREFIXES:
            return True

        # 3. 词根前有1-3个字母的前缀（常见情况）
        if 1 <= len(prefix_before_root) <= 3:
            return True

        # 4. 检查是否是变形的词根（如 vindiCATe 中的 dicat -> dict）
        if self._is_root_variant(word, root):
            return True

        return False

    def _is_root_variant(self, word: str, root: str) -> bool:
        """检查是否是词根的变形"""
        # 常见的词根变形模式
        variants = {
            "dict": ["dicat", "dicit", "dicat", "dict"],
            "voc": ["vocat", "vok"],
            "vok": ["vocat", "voc"],
            "spec": ["spect", "spic"],
            "spect": ["spec", "spic"],
            "mit": ["miss", "mitt"],
            "miss": ["mit", "mitt"],
        }

        if root in variants:
            for variant in variants[root]:
                if variant in word:
                    return True

        return False

    def are_latin_greek_related(self, word1: str, word2: str) -> Tuple[bool, float]:
        """检查两个词是否有共同的拉丁/希腊词根"""
        roots1 = self.extract_latin_greek_roots(word1)
        roots2 = self.extract_latin_greek_roots(word2)

        # 检查是否有共同词根
        common_roots = roots1 & roots2
        if common_roots:
            # 根据词根的重要性计算置信度
            confidence = 0.85  # 拉丁/希腊词根关系的基础置信度

            # 如果有多个共同词根，增加置信度
            if len(common_roots) > 1:
                confidence += 0.1

            # 如果是已知的好例子，提高置信度
            if self._is_known_latin_pair(word1, word2):
                confidence = 0.95

            return True, min(1.0, confidence)

        return False, 0.0

    def _is_known_latin_pair(self, word1: str, word2: str) -> bool:
        """检查是否是已知的良好拉丁词根配对"""
        known_pairs = {
            # dict词根组
            ("indict", "vindicate"),
            ("vindicate", "indict"),
            ("indict", "valediction"),
            ("valediction", "indict"),
            ("interdict", "vindicate"),
            ("vindicate", "interdict"),
            # loqu/log词根组
            ("monologue", "prologue"),
            ("prologue", "monologue"),
            ("loquacious", "grandiloquent"),
            ("grandiloquent", "loquacious"),
            ("soliloquy", "obloquy"),
            ("obloquy", "soliloquy"),
            # voc/vok词根组
            ("advocate", "vocation"),
            ("vocation", "advocate"),
            ("provoke", "revoke"),
            ("revoke", "provoke"),
            ("convoke", "revoke"),
            ("revoke", "convoke"),
            ("vociferous", "vocation"),
            ("vocation", "vociferous"),
            # verb词根组
            ("verbose", "verbatim"),
            ("verbatim", "verbose"),
            ("reverberate", "verbose"),
            ("verbose", "reverberate"),
            # claim/clam词根组
            ("claim", "disclaim"),
            ("disclaim", "claim"),
            ("claim", "declaim"),
            ("declaim", "claim"),
            ("clamor", "disclaim"),
            ("disclaim", "clamor"),
            # son词根组
            ("consonant", "dissonance"),
            ("dissonance", "consonant"),
            ("consonant", "resonant"),
            ("resonant", "consonant"),
            ("dissonance", "resonant"),
            ("resonant", "dissonance"),
            # nunc词根组
            ("denounce", "renounce"),
            ("renounce", "denounce"),
            ("denounce", "enunciate"),
            ("enunciate", "denounce"),
            ("renounce", "enunciate"),
            ("enunciate", "renounce"),
        }

        pair = (word1.lower(), word2.lower())
        return pair in known_pairs

    def vector_similarity_check(self, w1: str, w2: str) -> bool:
        """词向量相似度验证"""
        if model is None:
            return True  # 没有模型时默认通过
        try:
            sim = model.similarity(w1, w2)
            return sim >= self.vector_threshold
        except KeyError:
            return True

    def are_same_root(self, w1: str, w2: str) -> Tuple[bool, float]:
        """判断两个词是否有相同词根 - 支持拉丁/希腊词根"""
        w1_lower, w2_lower = w1.lower(), w2.lower()

        if w1_lower == w2_lower:
            return False, 0.0

        # 检查负缓存
        pair_key = tuple(sorted([w1_lower, w2_lower]))
        if pair_key in self._negative_cache:
            return False, 0.0

        # 适度放宽长度检查（GRE词汇差异可能较大）
        if abs(len(w1_lower) - len(w2_lower)) > 6:
            self._negative_cache.add(pair_key)
            return False, 0.0

        # 1. 拉丁/希腊词根关系检查（针对GRE词汇）
        is_latin_related, latin_confidence = self.are_latin_greek_related(
            w1_lower, w2_lower
        )
        if is_latin_related:
            return True, latin_confidence

        # 2. 明确的派生词识别（针对常见英语派生）
        if self._is_clear_derivational_pair(w1_lower, w2_lower):
            return True, 0.95

        # 3. 精确词干匹配 + 严格验证
        stem1, stem2 = self.get_stem(w1_lower), self.get_stem(w2_lower)
        if stem1 == stem2 and len(stem1) >= 4:
            # 必须通过严格验证
            if self._verify_stem_relationship(w1_lower, w2_lower, stem1):
                return True, 0.9

        # 添加到负缓存
        self._negative_cache.add(pair_key)
        return False, 0.0

    def _is_clear_derivational_pair(self, word1: str, word2: str) -> bool:
        """识别明确的派生词对"""
        # 明确的派生模式（基于常见英语构词法）
        clear_patterns = [
            # 形容词 + ly = 副词
            (lambda w: w.endswith("ly") and len(w) > 4, lambda w: w[:-2]),
            # 动词/名词 + ness = 名词
            (lambda w: w.endswith("ness") and len(w) > 6, lambda w: w[:-4]),
            # 动词 + ment = 名词
            (lambda w: w.endswith("ment") and len(w) > 6, lambda w: w[:-4]),
            # 动词 + tion = 名词
            (lambda w: w.endswith("tion") and len(w) > 6, lambda w: w[:-4]),
            # 动词 + able/ible = 形容词
            (lambda w: w.endswith("able") and len(w) > 6, lambda w: w[:-4]),
            (lambda w: w.endswith("ible") and len(w) > 6, lambda w: w[:-4]),
            # 名词 + ful = 形容词
            (lambda w: w.endswith("ful") and len(w) > 5, lambda w: w[:-3]),
            # 形容词 + ity = 名词
            (lambda w: w.endswith("ity") and len(w) > 5, lambda w: w[:-3]),
            # 动词 + ive = 形容词
            (lambda w: w.endswith("ive") and len(w) > 5, lambda w: w[:-3]),
            # 动词 + ing = 动名词/现在分词
            (lambda w: w.endswith("ing") and len(w) > 5, lambda w: w[:-3]),
            # 动词 + ed = 过去式/过去分词
            (lambda w: w.endswith("ed") and len(w) > 4, lambda w: w[:-2]),
        ]

        for check_func, extract_func in clear_patterns:
            # 检查word1是否匹配模式，word2是否是其词根
            if check_func(word1):
                root = extract_func(word1)
                if word2 == root or self._handle_spelling_changes(root) == word2:
                    return True

            # 反向检查
            if check_func(word2):
                root = extract_func(word2)
                if word1 == root or self._handle_spelling_changes(root) == word1:
                    return True

        return False

    def _handle_spelling_changes(self, root: str) -> str:
        """处理派生时的拼写变化"""
        # 常见的拼写变化规则
        if root.endswith("e"):
            return root[:-1]  # create -> creat (for creation)
        if root.endswith("y"):
            return root[:-1] + "i"  # happy -> happi (for happiness)
        if len(root) >= 3 and root[-1] == root[-2] and root[-1] in "bdfglmnprt":
            return root[:-1]  # run -> run (for running, but runnn -> runn)
        return root

    def _verify_stem_relationship(self, word1: str, word2: str, stem: str) -> bool:
        """验证词干关系的有效性 - 最严格版本"""
        # 词干必须足够长
        if len(stem) < 5:
            return False

        # 检查两个词是否都是通过添加合理的后缀形成的
        suffix1 = word1[len(stem) :] if word1.startswith(stem) else ""
        suffix2 = word2[len(stem) :] if word2.startswith(stem) else ""

        # 非常严格的后缀组合（只允许最常见的）
        strict_suffixes = {
            "",
            "s",
            "ed",
            "ing",
            "er",
            "ly",
            "ness",
            "ment",
            "tion",
            "able",
            "ful",
            "ive",
            "al",
            "ity",
        }

        # 两个后缀都必须是严格有效的
        if suffix1 not in strict_suffixes or suffix2 not in strict_suffixes:
            return False

        # 不允许两个词都只是添加了's'这种简单后缀
        if suffix1 == "s" and suffix2 == "s":
            return False

        # 检查是否是已知的好例子
        return self._is_known_good_example(word1, word2)

    def _is_known_good_example(self, word1: str, word2: str) -> bool:
        """检查是否是已知的好例子"""
        # 已知的好例子
        good_pairs = {
            ("virtual", "virtually"),
            ("virtually", "virtual"),
            ("attain", "attainable"),
            ("attainable", "attain"),
            ("ambiguous", "ambiguity"),
            ("ambiguity", "ambiguous"),
            ("remark", "remarkable"),
            ("remarkable", "remark"),
            ("disrupt", "disruptive"),
            ("disruptive", "disrupt"),
            ("distinct", "distinctive"),
            ("distinctive", "distinct"),
            ("conduct", "conductive"),
            ("conductive", "conduct"),
            ("exhaust", "exhaustive"),
            ("exhaustive", "exhaust"),
            ("exhaust", "exhaustible"),
            ("exhaustible", "exhaust"),
            ("exhaustive", "exhaustible"),
            ("exhaustible", "exhaustive"),
            ("excess", "excessive"),
            ("excessive", "excess"),
            ("refresh", "refreshment"),
            ("refreshment", "refresh"),
            ("renew", "renewable"),
            ("renewable", "renew"),
            ("captivate", "captivity"),
            ("captivity", "captivate"),
            ("legitimate", "legitimize"),
            ("legitimize", "legitimate"),
            ("accustom", "accustomed"),
            ("accustomed", "accustom"),
            ("perception", "perceptive"),
            ("perceptive", "perception"),
            ("retain", "retainer"),
            ("retainer", "retain"),
            ("retain", "retention"),
            ("retention", "retain"),
            ("dizzy", "dizziness"),
            ("dizziness", "dizzy"),
            ("maternal", "maternity"),
            ("maternity", "maternal"),
            ("bully", "bullying"),
            ("bullying", "bully"),
        }

        pair = (word1, word2)
        return pair in good_pairs

    def _process_word_batch(
        self, word_pairs: List[Tuple[Word, Word]]
    ) -> List[WordRelation]:
        """处理词对批次的辅助方法"""
        relations = []
        for w1, w2 in word_pairs:
            pair_key = tuple(sorted([w1.id, w2.id]))
            if pair_key in self.processed_pairs:
                continue

            same_root, confidence = self.are_same_root(w1.word, w2.word)
            if same_root and confidence >= self.min_confidence:
                self.processed_pairs.add(pair_key)
                relations.append(
                    WordRelation(
                        word_id=w1.id,
                        related_word_id=w2.id,
                        relation_type=RelationType.root,
                        confidence=confidence,
                    )
                )
        return relations

    def generate_relations(self, emitter=None) -> int:
        with get_session() as session:
            words = session.query(Word).all()
            total_words = len(words)

            if emitter:
                emitter.emit_progress(0, total_words, "Starting root relation generation...")

            # 预计算所有词的缓存以提高速度
            for i, word in enumerate(words):
                if emitter and i % 500 == 0:
                    emitter.emit_progress(i, total_words, f"Pre-computing word stems: {i}/{total_words}")
                self.get_stem(word.word)
                self.get_wordnet_derivations(word.word)

            relations_to_add = []
            total_found = 0

            # 分批处理词对
            batch_size = 1000
            word_pairs = []

            for i, w1 in enumerate(words):
                if emitter and i % 100 == 0:
                    emitter.emit_progress(i, total_words, f"Processing root pairs: {i}/{total_words} words, {total_found} found")

                for j in range(i + 1, total_words):
                    w2 = words[j]
                    word_pairs.append((w1, w2))

                    # 当收集够一批词对时处理
                    if len(word_pairs) >= batch_size:
                        batch_relations = self._process_word_batch(word_pairs)
                        relations_to_add.extend(batch_relations)
                        total_found += len(batch_relations)
                        word_pairs = []

                        # 批量插入数据库
                        if len(relations_to_add) >= 2000:
                            batch_insert_relations(session, relations_to_add)
                            relations_to_add = []

            # 处理剩余的词对
            if word_pairs:
                batch_relations = self._process_word_batch(word_pairs)
                relations_to_add.extend(batch_relations)
                total_found += len(batch_relations)

            # 插入剩余关系
            if relations_to_add:
                batch_insert_relations(session, relations_to_add)

            return total_found


def generate_root_relations():
    generator = RootRelationGenerator(min_confidence=0.8, vector_threshold=0.65)
    return generator.generate_relations()
