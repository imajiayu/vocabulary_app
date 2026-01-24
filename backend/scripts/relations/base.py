# -*- coding: utf-8 -*-
"""
关系生成器基础模块 - 共享工具和类型定义
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Set, Tuple, Optional
from abc import ABC, abstractmethod


@dataclass
class GenerationResult:
    """生成结果"""
    relations: List[Dict]  # 新关系列表
    logs: List[Dict]       # 处理日志列表
    stats: Dict            # 统计信息


class ProgressPrinter:
    """进度打印器 - 带进度条的控制台输出"""

    def __init__(self, total: int, prefix: str = "   "):
        self.total = total
        self.current = 0
        self.prefix = prefix
        self.start_time = datetime.now()
        self.last_print_time = datetime.now()

    def update(self, current: int, message: str = ""):
        """更新进度（限制打印频率避免刷屏）"""
        self.current = current
        now = datetime.now()

        # 限制打印频率：至少间隔 0.1 秒，或者是最后一条
        if (now - self.last_print_time).total_seconds() < 0.1 and current < self.total:
            return

        self.last_print_time = now
        percent = (current / self.total * 100) if self.total > 0 else 0
        elapsed = (now - self.start_time).total_seconds()

        if current > 0 and elapsed > 0:
            eta = (elapsed / current) * (self.total - current)
            eta_str = f"剩余 {eta:.0f}s"
        else:
            eta_str = "计算中..."

        bar_length = 30
        filled = int(bar_length * current / self.total) if self.total > 0 else 0
        bar = "█" * filled + "░" * (bar_length - filled)

        # 截断过长的消息
        if len(message) > 50:
            message = message[:47] + "..."

        print(f"\r{self.prefix}[{bar}] {percent:5.1f}% ({current}/{self.total}) {eta_str} | {message}", end="", flush=True)

    def finish(self, message: str = "完成"):
        """完成进度"""
        elapsed = (datetime.now() - self.start_time).total_seconds()
        print(f"\r{self.prefix}[{'█' * 30}] 100.0% ({self.total}/{self.total}) 耗时 {elapsed:.1f}s | {message}")


class BaseGenerator(ABC):
    """关系生成器基类"""

    # 子类必须定义关系类型
    relation_type: str = ""

    def __init__(self):
        self.processed_pairs: Set[Tuple[int, int]] = set()

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
        - GenerationResult: 包含新关系、日志和统计信息
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
        relations: List[Dict],
        existing_relations: Set[Tuple[int, int, str]]
    ) -> bool:
        """
        添加双向关系（如果不存在）

        返回: True 如果添加成功，False 如果已存在
        """
        if self._is_relation_exists(word_id, related_id, existing_relations):
            return False

        # 添加双向关系
        relations.append({
            'word_id': word_id,
            'related_word_id': related_id,
            'relation_type': self.relation_type,
            'confidence': round(confidence, 2)
        })
        relations.append({
            'word_id': related_id,
            'related_word_id': word_id,
            'relation_type': self.relation_type,
            'confidence': round(confidence, 2)
        })

        # 标记为已存在
        existing_relations.add((word_id, related_id, self.relation_type))
        existing_relations.add((related_id, word_id, self.relation_type))

        return True

    def _create_log(self, word_id: int, found_count: int) -> Dict:
        """创建处理日志"""
        return {
            'word_id': word_id,
            'relation_type': self.relation_type,
            'processed_at': datetime.now().isoformat(),
            'found_count': found_count
        }


def print_section(title: str, char: str = "─"):
    """打印分节标题"""
    print(f"\n{char * 60}")
    print(f"  {title}")
    print(f"{char * 60}")


def print_stat(label: str, value, indent: int = 3):
    """打印统计项"""
    print(f"{' ' * indent}{label}: {value}")
