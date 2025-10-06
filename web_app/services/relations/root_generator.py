# -*- coding: utf-8 -*-
"""
改进的词根关系生成器 v2
基于验证集优化的版本
"""
from typing import Tuple, Set, Dict, List
from nltk.stem import PorterStemmer
from web_app.models.word import Word, WordRelation, RelationType
from web_app.extensions import get_session
from web_app.services.relations.utils import batch_insert_relations
import re

stemmer = PorterStemmer()

# 扩展的拉丁/希腊词根数据库
LATIN_GREEK_ROOTS = {
    # 说话/声音相关
    "dict": {
        "meaning": "say, speak",
        "examples": ["indict", "vindicate", "valediction", "dictate", "predict", "contradict", "vindictive"],
        "variants": ["dicat", "dic"],
    },
    "loqu": {
        "meaning": "speak",
        "examples": ["loquacious", "grandiloquent", "obloquy", "soliloquy", "eloquent"],
        "variants": ["locut"],
    },
    "log": {
        "meaning": "speak, word, reason",
        "examples": ["monologue", "prologue", "dialogue", "eulogy", "apology", "logical"],
        "variants": ["logu", "logue"],
    },
    "voc": {
        "meaning": "call, voice",
        "examples": ["advocate", "vocation", "vociferous", "equivocate", "provocative", "irrevocable"],
        "variants": ["vocat", "vok"],
    },
    "vok": {
        "meaning": "call",
        "examples": ["provoke", "revoke", "convoke", "invoke", "evoke", "irrevocable"],
        "variants": ["vocat", "voc"],
    },
    "fess": {
        "meaning": "speak, confess",
        "examples": ["confess", "profess", "professor"],
        "variants": ["fes"],
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

    # 权威/信任相关
    "auth": {
        "meaning": "authority, increase",
        "examples": ["authoritarian", "authoritative", "authority", "author"],
        "variants": ["auct"],
    },
    "cred": {
        "meaning": "believe, trust",
        "examples": ["credential", "credible", "incredible", "credit", "confident"],
        "variants": ["creed"],
    },
    "fid": {
        "meaning": "faith, trust",
        "examples": ["confident", "fidelity", "confide"],
        "variants": ["fide"],
    },

    # 知识/感知相关（严格区分，不要混淆）
    "spect": {
        "meaning": "look, watch",
        "examples": ["inspect", "respect", "prospect", "spectator", "introspection", "circumspect",
                    "perspective", "spectacle", "spectrum", "speculation", "speculate", "prospective", "aspect"],
        "variants": [],
    },
    "speci": {
        "meaning": "kind, species",  # 改用speci避免与spect混淆
        "examples": ["special", "specialty", "species", "specialist", "specific", "specification", "specimen", "specify"],
        "variants": [],
    },
    "vid": {
        "meaning": "see",
        "examples": ["video", "evident", "provide", "divide"],
        "variants": ["vis"],
    },
    "vis": {
        "meaning": "see",
        "examples": ["visible", "vision", "supervise", "revision"],
        "variants": ["vid"],
    },

    # 行动/移动相关
    "mit": {
        "meaning": "send",
        "examples": ["transmit", "admit", "emit", "permit", "dissemination"],
        "variants": ["miss", "mitt"],
    },
    "miss": {
        "meaning": "send",
        "examples": ["missile", "mission", "dismiss", "remiss", "dissemination"],
        "variants": ["mit", "mitt"],
    },
    "mot": {
        "meaning": "move",
        "examples": ["motion", "motor", "promote", "remote"],
        "variants": ["mov", "mob"],
    },
    "pos": {
        "meaning": "place, put",
        "examples": ["position", "dispose", "compose", "impose", "disposition"],
        "variants": ["pon", "posit"],
    },
    "pon": {
        "meaning": "put, place",
        "examples": ["component", "exponent", "postpone", "disposition"],
        "variants": ["pos", "posit"],
    },

    # 对抗/反对相关（严格限制）
    "anti": {
        "meaning": "against, opposite",
        "examples": ["antiviral", "antonym", "antibiotic"],  # 移除antipathy（path词根独立）
        "variants": [],  # 不包含anticipate（anti+cip不是anti词根）
    },
    "vers": {
        "meaning": "turn",
        "examples": ["diverse", "reverse", "adverse", "versatile", "adversity", "incontrovertible", "universal", "diversion"],
        "variants": [],  # 不使用变体，避免过度匹配
    },
    "vert": {
        "meaning": "turn",
        "examples": ["convert", "divert", "revert", "subvert", "incontrovertible", "vertebrate"],
        "variants": [],  # 不使用变体，避免过度匹配
    },

    # 法律/规则相关
    "leg": {
        "meaning": "law, read",
        "examples": ["legal", "legitimate", "legacy", "legislation", "legislative"],
        "variants": ["legis"],
    },
    "junct": {
        "meaning": "join",
        "examples": ["junction", "conjunct", "adjunct", "disjunction"],
        "variants": ["join"],
    },

    # 生命/产生相关（拆分）
    "gener": {
        "meaning": "birth, kind",
        "examples": ["generate", "genetic", "degenerate", "general"],
        "variants": [],
    },
    "genu": {
        "meaning": "knee, inborn quality",
        "examples": ["genuine", "ingenious", "ingenuity"],
        "variants": ["geni"],
    },
    "anim": {
        "meaning": "life, soul",
        "examples": ["animate", "animal", "animation", "inanimate"],
        "variants": ["anima"],
    },
    "viv": {
        "meaning": "live",
        "examples": ["vivid", "survive", "revival", "inviolable"],
        "variants": ["vit", "viol"],
    },

    # 感受/情感相关
    "path": {
        "meaning": "feeling, disease",
        "examples": ["sympathy", "empathy", "antipathy", "pathetic", "pathogen"],
        "variants": ["patho"],
    },
    "phil": {
        "meaning": "love",
        "examples": ["philosophy", "philanthropist", "bibliophile"],
        "variants": ["philo"],
    },

    # 抓取/接收相关（分离不同含义，更严格）
    "capt": {
        "meaning": "take, capture",
        "examples": ["capture", "captive", "captivate"],
        "variants": [],
    },
    "cipat": {
        "meaning": "take, receive (anticipate)",
        "examples": ["anticipate", "participate"],
        "variants": [],
    },
    "capit": {
        "meaning": "head",
        "examples": ["capital", "captain", "decapitate"],
        "variants": [],
    },
    "cipi": {
        "meaning": "take, receive",
        "examples": ["recipient", "participate", "recipe"],
        "variants": [],
    },
    "cept": {
        "meaning": "take, receive",
        "examples": ["accept", "except", "reception", "exceptional"],
        "variants": [],
    },

    # 走/前进相关
    "ced": {
        "meaning": "go, yield",
        "examples": ["proceed", "exceed", "succeed", "recede", "recession"],
        "variants": ["cess", "ceed"],
    },
    "cess": {
        "meaning": "go",
        "examples": ["process", "access", "excess", "excessive", "recession"],
        "variants": ["ced", "ceed"],
    },

    # 做/制造相关（分离不同含义）
    "fabr": {
        "meaning": "make, build",
        "examples": ["fabric", "fabricate", "prefabricate"],
        "variants": [],
    },
    "facil": {
        "meaning": "easy, make easy",
        "examples": ["facile", "facility", "facilitate"],
        "variants": [],
    },
    "fect": {
        "meaning": "make, do",
        "examples": ["perfect", "defect", "affect"],  # 移除effect（太泛化）
        "variants": [],
    },
    "fici": {
        "meaning": "make, do",
        "examples": ["efficient", "efficiency", "proficient"],
        "variants": [],
    },

    # 显示/证明相关（拆分不同含义）
    "monstr": {
        "meaning": "show, demonstrate",
        "examples": ["demonstrate", "monster", "monstrous"],
        "variants": [],
    },
    "dem": {
        "meaning": "people",
        "examples": ["democracy", "epidemic", "predominant"],
        "variants": ["demo"],
    },
    "molish": {
        "meaning": "destroy",
        "examples": ["demolish"],
        "variants": [],
    },

    # 坚固/确认相关
    "firm": {
        "meaning": "strong, affirm",
        "examples": ["affirm", "confirm", "affirmative", "infirm"],
        "variants": ["firmat"],
    },

    # 切割/杀死相关（移除accidental，它是accident的派生）
    # accidental通过cide词根处理

    # 收集/问询相关（分离）
    "rog": {
        "meaning": "ask, claim",
        "examples": ["arrogant", "prerogative", "abrogate"],
        "variants": [],
    },

    # 和谐/一致相关
    "cord": {
        "meaning": "heart, harmony",
        "examples": ["accord", "discord", "concord", "record"],
        "variants": ["card"],
    },
    "harm": {
        "meaning": "harmony",
        "examples": ["harmony", "harmonious", "disharmony"],
        "variants": ["harmon"],
    },

    # 地方/位置相关（拆分不同含义）
    "loc": {
        "meaning": "place",
        "examples": ["locate", "allocate", "dislocate", "locale"],
        "variants": ["locat"],
    },
    "plac": {
        "meaning": "please, calm",
        "examples": ["placate", "placid", "complacent"],
        "variants": [],
    },
    "place": {
        "meaning": "place, position",
        "examples": ["place", "displace", "replace"],
        "variants": [],
    },

    # 拉/紧相关
    "strict": {
        "meaning": "tight, bind",
        "examples": ["strict", "restrict", "district", "distress"],
        "variants": ["string", "strain"],
    },

    # 流动相关
    "flu": {
        "meaning": "flow",
        "examples": ["fluid", "fluent", "influence", "affluent"],
        "variants": ["flux"],
    },

    # 变化相关
    "vari": {
        "meaning": "change, different",
        "examples": ["variable", "vary", "variety", "various"],
        "variants": ["var"],
    },
    "mut": {
        "meaning": "change",
        "examples": ["mutable", "immutable", "mutation", "commute", "mutual"],
        "variants": ["mutat"],
    },

    # 伸展/倾向相关
    "tens": {
        "meaning": "stretch, tense",
        "examples": ["extension", "tension", "pretension"],
        "variants": [],
    },
    "tenu": {
        "meaning": "thin, slender",
        "examples": ["tenuous", "attenuate"],
        "variants": [],
    },

    # 新/创新相关
    "nov": {
        "meaning": "new",
        "examples": ["novel", "novice", "innovate", "innovative", "renovation"],
        "variants": ["novat"],
    },

    # 触摸/完整相关
    "tact": {
        "meaning": "touch",
        "examples": ["contact", "intact", "tactile"],
        "variants": ["tang", "ting"],
    },

    # 违背/暴力相关
    "viol": {
        "meaning": "force, violate",
        "examples": ["violence", "violate", "inviolable"],
        "variants": ["violat"],
    },

    # 孤立相关
    "isol": {
        "meaning": "alone",
        "examples": ["isolate", "isolated", "isolation"],
        "variants": ["insul"],
    },

    # 刺激/激怒相关
    "irrit": {
        "meaning": "irritate",
        "examples": ["irritate", "irritable", "irritation"],
        "variants": ["irritat"],
    },

    # 道德相关
    "mor": {
        "meaning": "custom, morality",
        "examples": ["moral", "morality", "morale", "immoral"],
        "variants": ["moral"],
    },
    "eth": {
        "meaning": "custom, ethics",
        "examples": ["ethics", "ethic", "ethical"],
        "variants": ["ethi"],
    },

    # 标记/注意相关
    "not": {
        "meaning": "mark, note",
        "examples": ["note", "notable", "notice", "notify"],
        "variants": ["notat"],
    },

    # 营养相关
    "nutri": {
        "meaning": "nourish",
        "examples": ["nutrition", "nutritional", "nutrient"],
        "variants": ["nutrit"],
    },

    # 携带相关
    "port": {
        "meaning": "carry",
        "examples": ["transport", "import", "export", "portrait", "portable"],
        "variants": ["portat"],
    },

    # 统治/主导相关
    "domin": {
        "meaning": "master, rule",
        "examples": ["dominate", "dominant", "predominant", "domain"],
        "variants": ["domin"],
    },

    # 重量相关
    "ponder": {
        "meaning": "weight, consider",
        "examples": ["ponder", "ponderous", "preponderant"],
        "variants": ["pond"],
    },

    # 第一/主要相关
    "prin": {
        "meaning": "first, chief",
        "examples": ["prince", "principal", "principle"],
        "variants": ["prim"],
    },
    "prior": {
        "meaning": "before, earlier",
        "examples": ["priority", "prior", "prioritize"],
        "variants": [],
    },

    # 连接/绑定相关（拆分不同含义）
    "liab": {
        "meaning": "bind, liable",
        "examples": ["reliable", "reliably", "liability"],
        "variants": [],
    },
    "liev": {
        "meaning": "lift, lighten",
        "examples": ["relieve", "relief", "alleviate"],
        "variants": ["lieve", "leve"],
    },
    "lign": {
        "meaning": "bind, tie",
        "examples": ["ligament", "oblige"],
        "variants": ["lig"],
    },

    # 标记/符号相关
    "sign": {
        "meaning": "mark, sign",
        "examples": ["signal", "signature", "resign", "design", "significant"],
        "variants": ["signat"],
    },

    # 松开/解决相关
    "solv": {
        "meaning": "loosen, solve",
        "examples": ["solve", "resolve", "dissolve", "solution"],
        "variants": ["solut"],
    },

    # 切割相关
    "sect": {
        "meaning": "cut",
        "examples": ["section", "dissect", "intersect"],
        "variants": ["seg"],
    },
    "seg": {
        "meaning": "cut, separate",
        "examples": ["segment", "segregate", "segregation"],
        "variants": ["sect"],
    },

    # 河流/竞争相关
    "riv": {
        "meaning": "river, compete",
        "examples": ["river", "rival", "rivalry", "derive"],
        "variants": [],
    },

    # 群体相关
    "greg": {
        "meaning": "flock, gather",
        "examples": ["congregate", "segregate", "gregarious", "aggregate"],
        "variants": ["gregate"],
    },

    # 站立/法定相关
    "stat": {
        "meaning": "stand, state",
        "examples": ["state", "status", "statue", "statutory", "static"],
        "variants": ["statu", "sist"],
    },

    # 学习相关
    "stud": {
        "meaning": "study, eager",
        "examples": ["study", "student", "studious", "studio"],
        "variants": ["studi"],
    },

    # 倾倒/融合相关
    "fus": {
        "meaning": "pour, melt",
        "examples": ["fuse", "confuse", "fusion", "suffuse", "refuse"],
        "variants": ["fuse"],
    },

    # 坐相关
    "sed": {
        "meaning": "sit",
        "examples": ["sedentary", "sediment", "supersede", "reside"],
        "variants": ["sid", "sess"],
    },

    # 持有相关
    "ten": {
        "meaning": "hold, thin",
        "examples": ["tenant", "tenet", "tenuous", "tenure", "detain"],
        "variants": ["tain", "tin"],
    },

    # 扭曲/折磨相关
    "tort": {
        "meaning": "twist",
        "examples": ["torture", "torment", "contort", "distort"],
        "variants": ["torm", "torn"],
    },

    # 美德相关
    "virt": {
        "meaning": "virtue, excellence",
        "examples": ["virtue", "virtuous", "virtual"],
        "variants": ["virtu"],
    },

    # 充电/装载相关
    "charge": {
        "meaning": "load",
        "examples": ["charge", "discharge", "recharge", "surcharge"],
        "variants": [],
    },

    # 神经相关
    "neur": {
        "meaning": "nerve",
        "examples": ["neuron", "neural", "neurology"],
        "variants": ["neuro"],
    },

    # 心理相关
    "psych": {
        "meaning": "mind, soul",
        "examples": ["psychology", "psychological", "psyche", "psychiatry"],
        "variants": ["psycho"],
    },

    # 探索相关
    "plor": {
        "meaning": "explore, cry",
        "examples": ["explore", "exploratory", "exploration", "implore"],
        "variants": ["plore"],
    },

    # 生育/携带相关
    "fer": {
        "meaning": "carry, bear",
        "examples": ["transfer", "refer", "fertile", "fertility", "confer"],
        "variants": ["fert"],
    },

    # 引出/召唤相关
    "cit": {
        "meaning": "call, rouse",
        "examples": ["cite", "excite", "incite", "elicit", "elicitation"],
        "variants": ["cite"],
    },

    # 估计相关
    "estim": {
        "meaning": "value, estimate",
        "examples": ["estimate", "esteem", "estimation"],
        "variants": [],
    },

    # 规则相关
    "reg": {
        "meaning": "rule, straight",
        "examples": ["regular", "regulate", "irregularity", "regime"],
        "variants": ["regul"],
    },

    # 神经（nerve单独处理）
    "nerv": {
        "meaning": "nerve, sinew",
        "examples": ["nerve", "nervous"],
        "variants": [],
    },

    # 问询（独立的rog词根，不与gat混淆）
    "terrog": {
        "meaning": "ask, question",
        "examples": ["interrogate", "interrogation"],
        "variants": [],
    },

    # 切割/杀死（accidental相关）
    "cide": {
        "meaning": "cut, kill, fall",
        "examples": ["suicide", "homicide", "accident", "accidental"],
        "variants": ["cid"],
    },

    # 拉/紧（distress/district）
    "stress": {
        "meaning": "tight, draw tight",
        "examples": ["stress", "distress"],
        "variants": ["strain", "strict"],
    },

    # 信任（confident/credential需要分开）
    "fide": {
        "meaning": "faith, trust",
        "examples": ["confident", "confidence", "fidelity"],
        "variants": ["fid"],
    },

    # 倾倒/传播（dissemination）
    "semin": {
        "meaning": "seed, sow",
        "examples": ["seminar", "disseminate", "dissemination"],
        "variants": ["seminat"],
    },

    # 预测/说（dict系列细分）
    "predat": {
        "meaning": "prey, plunder",
        "examples": ["predator", "predatory", "predation"],
        "variants": [],
    },
    "vindict": {
        "meaning": "revenge, claim",
        "examples": ["vindicate", "vindictive", "vindication"],
        "variants": [],
    },
    "predict": {
        "meaning": "foretell",
        "examples": ["predict", "prediction", "unpredictable"],
        "variants": [],
    },

    # 连接/绑定（reliably/relieve需要分开）
    "liab": {
        "meaning": "bind, liable",
        "examples": ["reliable", "reliably", "liability"],
        "variants": [],
    },
    "liev": {
        "meaning": "lift, lighten",
        "examples": ["relieve", "relief"],
        "variants": [],
    },

    # 信任系统
    "cred": {
        "meaning": "believe, trust",
        "examples": ["credential", "credit", "credible"],
        "variants": [],
    },
    "fide": {
        "meaning": "faith, trust",
        "examples": ["confident", "confidence", "fidelity"],
        "variants": [],
    },

    # strict系统
    "strict": {
        "meaning": "tight, bind",
        "examples": ["strict", "restrict", "constrict"],
        "variants": [],
    },
    "stress": {
        "meaning": "tight, pressure",
        "examples": ["stress", "distress"],
        "variants": [],
    },
    "string": {
        "meaning": "tight, bind",
        "examples": ["string", "stringent", "district"],
        "variants": [],
    },
}

# 词根黑名单：某些词不应该匹配某些词根（即使包含该字符串）
ROOT_BLACKLIST = {
    "vert": ["overshadow", "advertise", "advert", "advertisement"],
    "vers": ["overshadow", "advertise", "advert", "advertisement", "conversation"],
    "anti": ["anticipate", "antic", "antique"],
    "dict": ["medication", "radical", "ludicrous"],  # 这些词的dict不是"说"的意思
    "port": ["important", "importance"],  # port在这里不是"携带"
    "speci": ["spectacular", "spectacle", "specious"],  # 这些是spect(看)不是speci(种类)
    "mit": ["summit"],  # summit是山顶，不是发送
    "miss": ["summit"],
    "tact": ["distinguish"],  # distinguish不是触摸的意思
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
    "un": "not",
    "ir": "not",
}


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
                return word[len(prefix):]
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
            after_root = word[len(root):]
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
            after_root = word[root_pos + len(root):]
            if len(after_root) >= 1:
                return True

        # 只允许非常短的前缀（1-2个字母）
        if 1 <= len(prefix_before_root) <= 2:
            # 而且前缀必须是常见的单字母前缀
            if prefix_before_root in ['a', 'e', 'i', 'o', 'u', 'de', 're', 'un', 'in']:
                after_root = word[root_pos + len(root):]
                if len(after_root) >= 1:
                    return True

        return False

    def _has_other_root_after(self, word: str, current_root: str) -> bool:
        """检查词根后面是否还有另一个词根（说明当前词根可能不是真正的词根）"""
        root_pos = word.find(current_root)
        if root_pos == -1:
            return False

        after_root = word[root_pos + len(current_root):]
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

    def generate_relations_for_words(self, words: List[str]) -> List[Tuple[str, str, float]]:
        """为给定的单词列表生成词根关系"""
        relations = []

        for i, w1 in enumerate(words):
            for j in range(i + 1, len(words)):
                w2 = words[j]
                same_root, confidence = self.are_same_root(w1, w2)

                if same_root and confidence >= self.min_confidence:
                    relations.append((w1, w2, confidence))

        return relations

    def _process_word_batch(self, word_pairs: List[Tuple[Word, Word]]) -> List[WordRelation]:
        """处理词对批次的辅助方法"""
        relations = []
        processed_pairs: Set[Tuple[int, int]] = set()

        for w1, w2 in word_pairs:
            pair_key = tuple(sorted([w1.id, w2.id]))
            if pair_key in processed_pairs:
                continue

            same_root, confidence = self.are_same_root(w1.word, w2.word)
            if same_root and confidence >= self.min_confidence:
                processed_pairs.add(pair_key)
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
        """生成所有词根关系并插入数据库"""
        with get_session() as session:
            words = session.query(Word).all()
            total_words = len(words)

            if emitter:
                emitter.emit_progress(
                    0, total_words, "Starting root relation generation..."
                )

            # 预计算所有词的缓存以提高速度
            for i, word in enumerate(words):
                if emitter and i % 500 == 0:
                    emitter.emit_progress(
                        i, total_words, f"Pre-computing word roots: {i}/{total_words}"
                    )
                # 预计算词根
                self.extract_latin_greek_roots(word.word)
                self.get_stem(word.word)

            relations_to_add = []
            total_found = 0

            # 分批处理词对
            batch_size = 1000
            word_pairs = []

            for i, w1 in enumerate(words):
                if emitter and i % 100 == 0:
                    emitter.emit_progress(
                        i,
                        total_words,
                        f"Processing root pairs: {i}/{total_words} words, {total_found} found",
                    )

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

            if emitter:
                emitter.emit_progress(
                    total_words, total_words, f"Completed! Found {total_found} root relations"
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

            new_cluster = {
                "root": root_name,
                "words": [w1, w2]
            }
            clusters.append(new_cluster)
            cluster_idx = len(clusters) - 1
            word_to_cluster[w1] = cluster_idx
            word_to_cluster[w2] = cluster_idx

    # 过滤掉被合并的cluster
    clusters = [c for c in clusters if c is not None]

    # 保存结果
    result = {
        "relations": [
            {"word1": w1, "word2": w2, "confidence": conf}
            for w1, w2, conf in relations
        ],
        "clusters": clusters,
        "total_relations": len(relations),
        "total_clusters": len(clusters)
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
