# -*- coding: utf-8 -*-
"""
关系生成任务管理服务

管理生成器的线程生命周期、进度追踪和数据库读写。
"""
import logging
from dataclasses import dataclass, field
from datetime import datetime
from threading import Event, Lock, Thread
from typing import Dict, List, Optional, Set, Tuple

from sqlalchemy import text

from backend.extensions import get_session
from backend.generators import (
    AntonymGenerator,
    ConfusedGenerator,
    RootGenerator,
    SynonymGenerator,
    TopicGenerator,
)

logger = logging.getLogger(__name__)

GENERATOR_MAP = {
    "synonym": SynonymGenerator,
    "antonym": AntonymGenerator,
    "root": RootGenerator,
    "confused": ConfusedGenerator,
    "topic": TopicGenerator,
}


@dataclass
class GenerationTask:
    """单个生成任务的状态"""
    user_id: str
    relation_type: str
    thread: Thread
    stop_event: Event
    status: str = "running"     # running | completed | stopped | error
    processed: int = 0
    total: int = 0
    found: int = 0
    saved: int = 0              # 已成功写入数据库的关系对数
    skipped: int = 0            # 因已生成过该类型关系而跳过的单词数
    error: Optional[str] = None
    started_at: datetime = field(default_factory=datetime.now)


class GenerationService:
    """生成任务管理器（单例，支持多用户）"""

    def __init__(self):
        # key: (user_id, relation_type) 元组，支持多用户同时生成
        self._tasks: Dict[Tuple[str, str], GenerationTask] = {}
        self._lock = Lock()

    def start(self, relation_type: str, user_id: str) -> bool:
        """启动生成任务。返回 True 表示成功启动，False 表示已在运行。"""
        if relation_type not in GENERATOR_MAP:
            raise ValueError(f"Unknown relation type: {relation_type}")

        task_key = (user_id, relation_type)

        with self._lock:
            task = self._tasks.get(task_key)
            if task and task.status == "running":
                return False

            stop_event = Event()
            thread = Thread(
                target=self._run_generation,
                args=(relation_type, user_id, stop_event, task_key),
                daemon=True,
            )

            self._tasks[task_key] = GenerationTask(
                user_id=user_id,
                relation_type=relation_type,
                thread=thread,
                stop_event=stop_event,
            )

            thread.start()
            return True

    def stop(self, relation_type: str, user_id: str) -> bool:
        """请求停止生成任务。返回 True 表示已发送停止信号。"""
        task_key = (user_id, relation_type)
        with self._lock:
            task = self._tasks.get(task_key)
            if not task or task.status != "running":
                return False
            task.stop_event.set()
            return True

    def get_status_for_user(self, user_id: str) -> Dict[str, dict]:
        """获取指定用户的所有任务状态"""
        result = {}
        for rt in GENERATOR_MAP:
            task_key = (user_id, rt)
            task = self._tasks.get(task_key)
            if task:
                result[rt] = {
                    "status": task.status,
                    "processed": task.processed,
                    "total": task.total,
                    "found": task.found,
                    "saved": task.saved,
                    "skipped": task.skipped,
                    "error": task.error,
                }
            else:
                result[rt] = {"status": "idle"}
        return result

    def has_active_tasks_for_user(self, user_id: str) -> bool:
        """指定用户是否有正在运行的任务"""
        for rt in GENERATOR_MAP:
            task_key = (user_id, rt)
            task = self._tasks.get(task_key)
            if task and task.status == "running":
                return True
        return False

    # ═══════════════════════════════════════════════════════════════════════
    # 内部方法
    # ═══════════════════════════════════════════════════════════════════════

    def _run_generation(self, relation_type: str, user_id: str, stop_event: Event, task_key: Tuple[str, str]):
        """线程目标函数：执行完整的生成流程"""
        task = self._tasks[task_key]

        try:
            # 1. 读取数据库
            words, word_index, existing_relations, processed_ids = self._load_data(
                relation_type, user_id
            )

            # 计算跳过数（已在 log 中的单词，取交集防止残留数据）
            word_ids = {w['id'] for w in words}
            task.skipped = len(processed_ids & word_ids)
            task.total = len(words) - task.skipped

            # 2. 创建回调
            def on_progress(processed: int, total: int, found: int):
                task.processed = processed
                task.total = total
                task.found = found

            def on_save(relations: List[Dict], logs: List[Dict]):
                self._save_batch(relations, logs, user_id)
                # 关系双向存储，每对 2 条记录；saved 与 found 同单位（对数）
                task.saved += len(relations) // 2

            # 3. 创建生成器
            generator_cls = GENERATOR_MAP[relation_type]
            generator = generator_cls(
                on_progress=on_progress,
                stop_event=stop_event,
                on_save=on_save,
            )

            # 4. 执行生成（结果通过 on_save 增量保存）
            result = generator.generate(words, word_index, existing_relations, processed_ids)

            # 5. 更新最终状态
            task.found = result.stats.get("total_found", 0)

            if stop_event.is_set():
                task.status = "stopped"
            else:
                task.status = "completed"

        except Exception as e:
            logger.exception(f"Generation failed for {relation_type}: {e}")
            task.status = "error"
            task.error = str(e)

    def _load_data(
        self, relation_type: str, user_id: str
    ) -> Tuple[List[Dict], Dict[str, int], Set[Tuple[int, int, str]], Set[int]]:
        """从数据库加载生成所需的全部数据"""
        with get_session() as session:
            # 加载用户的所有单词
            rows = session.execute(
                text("SELECT id, word, definition FROM words WHERE user_id = :uid ORDER BY id"),
                {"uid": user_id},
            ).fetchall()

            words = [{"id": r[0], "word": r[1], "definition": r[2] or ""} for r in rows]
            word_index = {w["word"].lower(): w["id"] for w in words}

            # 加载已有关系
            rel_rows = session.execute(
                text(
                    "SELECT word_id, related_word_id, relation_type "
                    "FROM words_relations WHERE user_id = :uid"
                ),
                {"uid": user_id},
            ).fetchall()

            existing_relations: Set[Tuple[int, int, str]] = {
                (r[0], r[1], r[2]) for r in rel_rows
            }

            # 加载已处理的单词 ID（仅当前关系类型）
            log_rows = session.execute(
                text(
                    "SELECT word_id FROM relation_generation_log "
                    "WHERE user_id = :uid AND relation_type = :rt"
                ),
                {"uid": user_id, "rt": relation_type},
            ).fetchall()

            processed_ids: Set[int] = {r[0] for r in log_rows}

        return words, word_index, existing_relations, processed_ids

    def _save_batch(self, relations: List[Dict], logs: List[Dict], user_id: str):
        """增量保存一批关系和日志到数据库（独立事务）"""
        BATCH_SIZE = 500

        with get_session() as session:
            try:
                # 批量插入关系
                if relations:
                    for offset in range(0, len(relations), BATCH_SIZE):
                        batch = relations[offset:offset + BATCH_SIZE]
                        values_parts = []
                        params: dict = {}
                        for i, rel in enumerate(batch):
                            values_parts.append(
                                f"(:u{i}, :w{i}, :r{i}, :t{i}, :c{i})"
                            )
                            params[f"u{i}"] = user_id
                            params[f"w{i}"] = rel["word_id"]
                            params[f"r{i}"] = rel["related_word_id"]
                            params[f"t{i}"] = rel["relation_type"]
                            params[f"c{i}"] = rel["confidence"]

                        session.execute(
                            text(
                                "INSERT INTO words_relations "
                                "(user_id, word_id, related_word_id, relation_type, confidence) "
                                f"VALUES {', '.join(values_parts)} "
                                "ON CONFLICT (word_id, related_word_id, relation_type) DO NOTHING"
                            ),
                            params,
                        )

                # 批量 upsert 生成日志
                if logs:
                    for offset in range(0, len(logs), BATCH_SIZE):
                        batch = logs[offset:offset + BATCH_SIZE]
                        values_parts = []
                        params = {}
                        for i, log_entry in enumerate(batch):
                            values_parts.append(
                                f"(:u{i}, :w{i}, :t{i}, :p{i}, :f{i})"
                            )
                            params[f"u{i}"] = user_id
                            params[f"w{i}"] = log_entry["word_id"]
                            params[f"t{i}"] = log_entry["relation_type"]
                            params[f"p{i}"] = log_entry["processed_at"]
                            params[f"f{i}"] = log_entry["found_count"]

                        session.execute(
                            text(
                                "INSERT INTO relation_generation_log "
                                "(user_id, word_id, relation_type, processed_at, found_count) "
                                f"VALUES {', '.join(values_parts)} "
                                "ON CONFLICT (word_id, relation_type) "
                                "DO UPDATE SET processed_at = EXCLUDED.processed_at, "
                                "found_count = EXCLUDED.found_count"
                            ),
                            params,
                        )

                session.commit()
                logger.info(
                    f"Batch saved: {len(relations)} relations, {len(logs)} logs"
                )

            except Exception:
                session.rollback()
                raise


# 单例
generation_service = GenerationService()
