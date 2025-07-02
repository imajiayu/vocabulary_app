# -*- coding: utf-8 -*-
"""
关系生成器基础模块 - 共享工具和类型定义

服务模式：通过 on_progress 回调报告进度，通过 stop_event 支持中断，
通过 on_save 回调增量保存结果（达到阈值自动刷入数据库）。
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Dict, List, Optional, Set, Tuple
from threading import Event
from abc import ABC, abstractmethod


@dataclass
class GenerationResult:
    """生成结果（stats 为主，relations/logs 已通过 on_save 增量保存）"""
    relations: List[Dict]  # 保留字段（增量模式下为空列表）
    logs: List[Dict]       # 保留字段（增量模式下为空列表）
    stats: Dict            # 统计信息


class BaseGenerator(ABC):
    """关系生成器基类"""

    # 子类必须定义关系类型
    relation_type: str = ""
    # 缓冲区达到此阈值时自动 flush
    FLUSH_THRESHOLD = 200

    def __init__(
        self,
        on_progress: Optional[Callable[[int, int, int], None]] = None,
        stop_event: Optional[Event] = None,
        on_save: Optional[Callable[[List[Dict], List[Dict]], None]] = None,
    ):
        self.processed_pairs: Set[Tuple[int, int]] = set()
        self._on_progress = on_progress  # (processed, total, found)
        self._stop_event = stop_event
        self._on_save = on_save          # (relations, logs) → save to DB
        self._pending_relations: List[Dict] = []
        self._pending_logs: List[Dict] = []

    def _is_stopped(self) -> bool:
        return self._stop_event is not None and self._stop_event.is_set()

    def _report_progress(self, processed: int, total: int, found: int):
        if self._on_progress:
            self._on_progress(processed, total, found)

    @abstractmethod
    def generate(
        self,
        words: List[Dict],
        word_index: Dict[str, int],
        existing_relations: Set[Tuple[int, int, str]],
        processed_word_ids: Set[int]
    ) -> GenerationResult:
        """
        生成关系

        参数:
        - words: 单词列表 [{'id': int, 'word': str, 'definition': str}, ...]
        - word_index: 单词索引 {word_lower: word_id}
        - existing_relations: 已存在的关系 {(word_id, related_id, type), ...}
        - processed_word_ids: 已处理的单词ID集合

        返回:
        - GenerationResult: stats 为主；关系和日志已通过 on_save 增量保存
        """
        pass

    def _is_relation_exists(
        self,
        word_id: int,
        related_id: int,
        existing_relations: Set[Tuple[int, int, str]]
    ) -> bool:
        """检查关系是否已存在（双向检查）"""
        return (
            (word_id, related_id, self.relation_type) in existing_relations or
            (related_id, word_id, self.relation_type) in existing_relations
        )

    def _add_relation(
        self,
        word_id: int,
        related_id: int,
        confidence: float,
        existing_relations: Set[Tuple[int, int, str]]
    ) -> bool:
        """
        添加双向关系到缓冲区（如果不存在）

        返回: True 如果添加成功，False 如果已存在
        """
        if self._is_relation_exists(word_id, related_id, existing_relations):
            return False

        # 添加双向关系到缓冲区
        self._pending_relations.append({
            'word_id': word_id,
            'related_word_id': related_id,
            'relation_type': self.relation_type,
            'confidence': round(confidence, 2)
        })
        self._pending_relations.append({
            'word_id': related_id,
            'related_word_id': word_id,
            'relation_type': self.relation_type,
            'confidence': round(confidence, 2)
        })

        # 标记为已存在
        existing_relations.add((word_id, related_id, self.relation_type))
        existing_relations.add((related_id, word_id, self.relation_type))

        return True

    def _add_log(self, word_id: int, found_count: int):
        """添加处理日志到缓冲区"""
        self._pending_logs.append({
            'word_id': word_id,
            'relation_type': self.relation_type,
            'processed_at': datetime.now().isoformat(),
            'found_count': found_count
        })

    def _flush(self, force: bool = False):
        """将缓冲区数据刷入数据库（达到阈值或 force=True 时执行）"""
        if not self._on_save:
            return
        if force or len(self._pending_relations) >= self.FLUSH_THRESHOLD:
            if self._pending_relations or self._pending_logs:
                self._on_save(self._pending_relations, self._pending_logs)
                self._pending_relations = []
                self._pending_logs = []
