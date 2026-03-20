# -*- coding: utf-8 -*-
"""
主题关系生成器

基于 WordNet 语义层级聚类，找到真正有主题关联的词汇。

双阶段策略：
  Phase 1 — 上位词聚类：共享同一语义祖先的词汇（如 salmon ↔ trout 共享 fish）
  Phase 2 — 释义交叉引用：释义中互相提及的词汇（如 surgeon 的释义提到 surgery）
"""
from collections import defaultdict
from typing import Callable, Dict, List, Optional, Set, Tuple
from functools import lru_cache
from threading import Event
import re

from .base import BaseGenerator, GenerationResult

try:
    from nltk.corpus import wordnet
    NLTK_AVAILABLE = True
except ImportError:
    NLTK_AVAILABLE = False

# ─── 常量 ──────────────────────────────────────────────────────────

# 过于宽泛的上位词，不应作为主题分组依据
_GENERIC_ANCESTORS = frozenset({
    'entity.n.01', 'physical_entity.n.01', 'abstraction.n.06',
    'thing.n.12', 'object.n.01', 'whole.n.02', 'artifact.n.01',
    'psychological_feature.n.01', 'event.n.01', 'state.n.02',
    'act.n.02', 'attribute.n.02', 'relation.n.01', 'group.n.01',
    'measure.n.02', 'phenomenon.n.01', 'communication.n.02',
    'content.n.05', 'cognition.n.01', 'feeling.n.01',
    'process.n.06', 'substance.n.01', 'matter.n.03',
    'causal_agent.n.01', 'organism.n.01', 'person.n.01',
    'quality.n.01', 'property.n.02', 'social_event.n.01',
    'change.n.03', 'action.n.01', 'ability.n.02',
    'living_thing.n.01', 'unit.n.03', 'condition.n.01',
    'people.n.01', 'natural_object.n.01',
})

# 释义分词停用词
_STOP_WORDS = frozenset({
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'can', 'shall',
    'of', 'in', 'to', 'for', 'with', 'on', 'at', 'from', 'by',
    'about', 'as', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'between', 'under', 'over', 'or', 'and',
    'but', 'if', 'not', 'no', 'so', 'up', 'out', 'that', 'this',
    'it', 'its', 'than', 'other', 'such', 'more', 'some', 'any',
    'each', 'every', 'all', 'most', 'very', 'also', 'just', 'one',
    'two', 'used', 'using', 'use', 'make', 'made', 'making',
    'something', 'someone', 'thing', 'way', 'part', 'form',
    'especially', 'particularly', 'usually', 'often', 'typically',
    'relating', 'related', 'involving', 'characterized', 'large',
    'small', 'many', 'much', 'well', 'like', 'another', 'same',
    'different', 'various', 'several', 'certain', 'given',
    'without', 'within', 'rather', 'whose', 'whom', 'which',
    'what', 'when', 'where', 'how', 'only', 'kind', 'type',
})

# ─── 缓存辅助函数 ──────────────────────────────────────────────────


@lru_cache(maxsize=10000)
def _get_synsets(word: str):
    """缓存 WordNet synsets 查询（仅最常见义项，避免罕见义项产生噪声关联）"""
    if not NLTK_AVAILABLE:
        return ()
    return tuple(wordnet.synsets(word.lower())[:1])


@lru_cache(maxsize=50000)
def _get_ancestors(synset_name: str, max_depth: int, min_ancestor_depth: int):
    """
    获取 synset 的有效祖先节点（BFS，缓存结果）

    仅返回 min_depth >= min_ancestor_depth 且不在黑名单中的祖先。
    """
    try:
        synset = wordnet.synset(synset_name)
    except Exception:
        return frozenset()

    ancestors = set()
    queue = [(synset, 0)]
    visited = {synset_name}

    while queue:
        current, depth = queue.pop(0)
        if depth >= max_depth:
            continue
        for hypernym in current.hypernyms():
            hname = hypernym.name()
            if hname not in visited:
                visited.add(hname)
                if hname not in _GENERIC_ANCESTORS and hypernym.min_depth() >= min_ancestor_depth:
                    ancestors.add(hname)
                queue.append((hypernym, depth + 1))

    return frozenset(ancestors)


_DEFN_TOKEN_RE = re.compile(r'[a-z]+')


def _tokenize_definition(definition: str) -> Set[str]:
    """提取释义中的有效内容词（去停用词，长度 >= 4）"""
    words = set(_DEFN_TOKEN_RE.findall(definition.lower()))
    return {w for w in words - _STOP_WORDS if len(w) >= 4}


# ─── 生成器 ────────────────────────────────────────────────────────


class TopicGenerator(BaseGenerator):
    """
    主题关系生成器 — 基于 WordNet 语义层级聚类

    Phase 1 — 上位词聚类：
      对每个单词取 WordNet synsets → 沿上位词树上溯 → 共享有效祖先的单词
      归入同一主题组 → 组内两两配对，置信度随组规模递减。

    Phase 2 — 释义交叉引用：
      若单词 A 的 WordNet 释义中提到了用户词表中的单词 B → 建立主题关联。
      可捕捉跨词性/跨层级关联（如 surgeon ↔ surgery, botanical ↔ plant）。
    """

    relation_type = "topic"

    # 上位词聚类参数
    MAX_HYPERNYM_DEPTH = 5       # 上溯层数
    MIN_ANCESTOR_DEPTH = 5       # 祖先最小深度（过滤 animal/plant 等宽泛概念）
    MAX_GROUP_SIZE = 25           # 单组最大词数
    MIN_GROUP_SIZE = 2            # 单组最小词数
    MAX_RELATIONS_PER_WORD = 5    # 每词最多主题关联数（置信度排序，优先保留最精确的）

    # 释义交叉引用参数
    MIN_DEFINITION_WORD_LEN = 4   # 释义词最短长度

    # 进度比例（三阶段映射到 0-100%）
    _PHASE1_RATIO = 0.4           # Phase 1 占 40%
    _PHASE2_RATIO = 0.3           # Phase 2 占 30%
    _WRITE_RATIO = 0.3            # 写入占 30%

    def __init__(
        self,
        on_progress: Optional[Callable[[int, int, int], None]] = None,
        stop_event: Optional[Event] = None,
        on_save: Optional[Callable] = None,
    ):
        super().__init__(on_progress=on_progress, stop_event=stop_event, on_save=on_save)

    def _scaled_progress(self, phase_frac: float, phase_offset: float,
                         total: int) -> int:
        """将阶段内进度映射到全局进度值"""
        return int(total * (phase_offset + phase_frac))

    def generate(
        self,
        words: List[Dict],
        word_index: Dict[str, int],
        existing_relations: Set[Tuple[int, int, str]],
        processed_word_ids: Set[int]
    ) -> GenerationResult:
        """生成主题关系（双阶段）"""

        if not NLTK_AVAILABLE:
            return GenerationResult(relations=[], logs=[], stats={'error': 'nltk not available'})

        unprocessed = [w for w in words if w['id'] not in processed_word_ids]
        if not unprocessed:
            return GenerationResult(relations=[], logs=[], stats={'skipped': True})

        unprocessed_ids = {w['id'] for w in unprocessed}
        total_found = 0
        skipped_existing = 0
        skipped_capped = 0
        word_found_counts: Dict[int, int] = {}
        pair_best_confidence: Dict[Tuple[int, int], float] = {}

        # 进度总量 = len(unprocessed)，与其他生成器一致
        progress_total = len(unprocessed)
        n_words = len(words)

        # ═══ Phase 1: 上位词聚类 (0% ~ 40%) ═══
        ancestor_groups: Dict[str, Set[int]] = defaultdict(set)

        for idx, w in enumerate(words):
            if self._is_stopped():
                break
            synsets = _get_synsets(w['word'])
            for synset in synsets:
                ancestors = _get_ancestors(
                    synset.name(), self.MAX_HYPERNYM_DEPTH, self.MIN_ANCESTOR_DEPTH
                )
                for anc_name in ancestors:
                    ancestor_groups[anc_name].add(w['id'])

            if (idx + 1) % 50 == 0 or idx == n_words - 1:
                frac = self._PHASE1_RATIO * (idx + 1) / n_words
                self._report_progress(
                    self._scaled_progress(frac, 0, progress_total),
                    progress_total, total_found
                )

        # 从有效组中提取词对
        hypernym_groups_count = 0
        for anc_name, wids in ancestor_groups.items():
            group_size = len(wids)
            if group_size < self.MIN_GROUP_SIZE or group_size > self.MAX_GROUP_SIZE:
                continue

            hypernym_groups_count += 1
            # 组越小 → 主题越精确 → 置信度越高
            confidence = round(max(0.50, 1.0 - 0.02 * (group_size - 2)), 2)

            ids_list = sorted(wids)
            for i in range(len(ids_list)):
                for j in range(i + 1, len(ids_list)):
                    w1, w2 = ids_list[i], ids_list[j]
                    # 至少一个必须是未处理的
                    if w1 not in unprocessed_ids and w2 not in unprocessed_ids:
                        continue
                    pair = (min(w1, w2), max(w1, w2))
                    if pair not in pair_best_confidence or confidence > pair_best_confidence[pair]:
                        pair_best_confidence[pair] = confidence

        phase1_pairs = len(pair_best_confidence)

        # ═══ Phase 2: 释义双向交叉引用 (40% ~ 70%) ═══
        # 只有 A 的释义提到 B 且 B 的释义也提到 A 时才建立关系
        defn_pairs_added = 0
        if not self._is_stopped():
            user_word_set = set(word_index.keys())

            # 构建每个词的释义内容词集合：word_id → {definition content words}
            word_defn_words: Dict[int, Set[str]] = {}

            for idx, w in enumerate(words):
                if self._is_stopped():
                    break
                synsets = _get_synsets(w['word'])
                content_words: Set[str] = set()
                for synset in synsets:
                    content_words |= _tokenize_definition(synset.definition())
                # 只保留用户词表中的词，排除自身
                content_words &= user_word_set
                content_words.discard(w['word'].lower())
                if content_words:
                    word_defn_words[w['id']] = content_words

                if (idx + 1) % 50 == 0 or idx == n_words - 1:
                    frac = self._PHASE2_RATIO * (idx + 1) / n_words
                    self._report_progress(
                        self._scaled_progress(frac, self._PHASE1_RATIO, progress_total),
                        progress_total, total_found
                    )

            # 双向检查：A 的释义提到 B 且 B 的释义提到 A
            word_to_str = {w['id']: w['word'].lower() for w in words}
            for wid_a, defn_words_a in word_defn_words.items():
                for ref_word in defn_words_a:
                    if ref_word not in word_index:
                        continue
                    wid_b = word_index[ref_word]
                    if wid_b == wid_a:
                        continue
                    if wid_a not in unprocessed_ids and wid_b not in unprocessed_ids:
                        continue
                    # B 的释义也必须提到 A
                    defn_words_b = word_defn_words.get(wid_b)
                    if not defn_words_b or word_to_str.get(wid_a) not in defn_words_b:
                        continue

                    pair = (min(wid_a, wid_b), max(wid_a, wid_b))
                    if pair not in pair_best_confidence:
                        pair_best_confidence[pair] = 0.75
                        defn_pairs_added += 1

        # ═══ 写入关系 (70% ~ 100%) ═══
        sorted_pairs = sorted(pair_best_confidence.items(), key=lambda x: -x[1])
        total_pairs = len(sorted_pairs)

        # 每词关联计数（含已有关系，确保跨次运行不突破上限）
        word_relation_counts: Dict[int, int] = {}
        for (w1, _, rtype) in existing_relations:
            if rtype == self.relation_type:
                word_relation_counts[w1] = word_relation_counts.get(w1, 0) + 1

        for pair_idx, ((w1, w2), conf) in enumerate(sorted_pairs):
            if self._is_stopped():
                break

            # Per-word cap：避免单个词产生过多关联
            count1 = word_relation_counts.get(w1, 0)
            count2 = word_relation_counts.get(w2, 0)
            if count1 >= self.MAX_RELATIONS_PER_WORD or count2 >= self.MAX_RELATIONS_PER_WORD:
                skipped_capped += 1
                continue

            if self._add_relation(w1, w2, conf, existing_relations):
                total_found += 1
                word_relation_counts[w1] = count1 + 1
                word_relation_counts[w2] = count2 + 1
                word_found_counts[w1] = word_found_counts.get(w1, 0) + 1
                word_found_counts[w2] = word_found_counts.get(w2, 0) + 1
            else:
                skipped_existing += 1

            self._flush()

            if (pair_idx + 1) % 200 == 0 or pair_idx == total_pairs - 1:
                frac = self._WRITE_RATIO * (pair_idx + 1) / total_pairs
                self._report_progress(
                    self._scaled_progress(frac, self._PHASE1_RATIO + self._PHASE2_RATIO,
                                          progress_total),
                    progress_total, total_found
                )

        # ═══ 日志 ═══
        if self._is_stopped():
            # 停止时只为实际写入了关系的词记录日志，避免未处理的词被错误标记
            for w in unprocessed:
                wid = w['id']
                if wid in word_found_counts:
                    self._add_log(wid, word_found_counts[wid])
        else:
            for w in unprocessed:
                self._add_log(w['id'], word_found_counts.get(w['id'], 0))

        self._flush(force=True)

        stats = {
            'total_found': total_found,
            'skipped_existing': skipped_existing,
            'skipped_capped': skipped_capped,
            'hypernym_groups': hypernym_groups_count,
            'phase1_pairs': phase1_pairs,
            'definition_pairs': defn_pairs_added,
            'processed_count': len(unprocessed),
        }

        return GenerationResult(relations=[], logs=[], stats=stats)
