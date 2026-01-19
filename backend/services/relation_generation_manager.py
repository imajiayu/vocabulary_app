# -*- coding: utf-8 -*-
"""
关系生成管理器 - 使用线程池 + 轮询获取进度

为什么使用线程而不是多进程：
1. SQLAlchemy session 在多进程间无法共享
2. macOS 上 spawn 模式会导致导入失败
3. 关系生成是 IO 密集型（数据库操作），线程足够
"""
import threading
import queue
from typing import Optional, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class TaskProgress:
    """任务进度状态"""
    relation_type: str
    status: str = "running"  # running, completed, error
    current: int = 0
    total: int = 0
    percent: float = 0.0
    message: str = ""
    error: str = ""
    total_count: int = 0  # 完成时的总数
    updated_at: datetime = field(default_factory=datetime.now)


# 存储所有任务的进度状态
_progress_store: Dict[str, TaskProgress] = {}
_store_lock = threading.Lock()


def _generate_worker(relation_type: str, progress_queue: queue.Queue):
    """
    工作线程函数 - 执行关系生成

    参数:
    - relation_type: 关系类型
    - progress_queue: 线程间通信队列
    """
    try:
        from backend.services.relations.progress_emitter import ProgressEmitter

        # 创建进度发射器
        emitter = ProgressEmitter(progress_queue, relation_type)

        # 根据类型导入对应的生成器并执行（使用自动增量模式）
        if relation_type == "synonym":
            from backend.services.relations.synonym_generator import SynonymGenerator
            generator = SynonymGenerator(min_confidence=0.6)
            count = generator.generate_relations(emitter)
        elif relation_type == "antonym":
            from backend.services.relations.antonym_generator import AntonymGenerator
            generator = AntonymGenerator()
            count = generator.generate_relations(emitter)
        elif relation_type == "root":
            from backend.services.relations.root_generator import RootRelationGenerator
            generator = RootRelationGenerator(min_confidence=0.8)
            count = generator.generate_relations(emitter)
        elif relation_type == "confused":
            from backend.services.relations.confused_generator import ConfusedWordsGenerator
            generator = ConfusedWordsGenerator(min_length=5)
            count = generator.generate_relations(emitter)
        elif relation_type == "topic":
            from backend.services.relations.topic_generator import IELTSTopicGenerator
            generator = IELTSTopicGenerator()
            count = generator.generate_relations(emitter)
        else:
            raise ValueError(f"Unknown relation type: {relation_type}")

        # 发送完成信号
        emitter.emit_complete(count, f"{relation_type} generation completed")

    except Exception as e:
        # 发送错误信号
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        from backend.services.relations.progress_emitter import ProgressEmitter
        emitter = ProgressEmitter(progress_queue, relation_type)
        emitter.emit_error(error_msg)


class RelationGenerationManager:
    """关系生成管理器 - 管理多个并发的生成任务（线程版）"""

    def __init__(self):
        self.tasks = {}  # {relation_type: (thread, queue, stop_event)}

    def start_generation(self, relation_type: str) -> bool:
        """
        启动一个生成任务

        返回:
        - True: 成功启动
        - False: 该类型已经在运行中
        """
        # 检查是否已经在运行
        if relation_type in self.tasks:
            thread, _, _ = self.tasks[relation_type]
            if thread.is_alive():
                return False

        # 初始化进度状态
        with _store_lock:
            _progress_store[relation_type] = TaskProgress(
                relation_type=relation_type,
                status="running",
                message="Starting..."
            )

        # 创建线程间通信队列
        progress_queue = queue.Queue()
        stop_event = threading.Event()

        # 创建并启动工作线程
        worker_thread = threading.Thread(
            target=_generate_worker,
            args=(relation_type, progress_queue),
            daemon=True
        )
        worker_thread.start()

        # 保存任务信息
        self.tasks[relation_type] = (worker_thread, progress_queue, stop_event)

        # 启动队列监听器（在单独线程中）
        listener_thread = threading.Thread(
            target=self._listen_progress,
            args=(relation_type, progress_queue),
            daemon=True
        )
        listener_thread.start()

        return True

    def _listen_progress(self, relation_type: str, progress_queue: queue.Queue):
        """监听工作线程发送的进度信息并更新状态存储"""
        while True:
            try:
                # 从队列获取消息（阻塞等待）
                message = progress_queue.get(timeout=1)

                with _store_lock:
                    if message["type"] == "progress":
                        _progress_store[relation_type] = TaskProgress(
                            relation_type=message["relation_type"],
                            status="running",
                            current=message["current"],
                            total=message["total"],
                            percent=message["percent"],
                            message=message["message"]
                        )

                    elif message["type"] == "complete":
                        _progress_store[relation_type] = TaskProgress(
                            relation_type=message["relation_type"],
                            status="completed",
                            current=message.get("total_count", 0),
                            total=message.get("total_count", 0),
                            percent=100.0,
                            message=message["message"],
                            total_count=message["total_count"]
                        )
                        break

                    elif message["type"] == "error":
                        _progress_store[relation_type] = TaskProgress(
                            relation_type=message["relation_type"],
                            status="error",
                            error=message["message"],
                            message="Error occurred"
                        )
                        break

            except queue.Empty:
                # 超时，检查线程是否还在运行
                if relation_type in self.tasks:
                    thread, _, _ = self.tasks[relation_type]
                    if not thread.is_alive():
                        break
                else:
                    break
            except Exception as e:
                print(f"Error in progress listener for {relation_type}: {e}")
                break

        # 清理任务
        if relation_type in self.tasks:
            del self.tasks[relation_type]

    def is_running(self, relation_type: str) -> bool:
        """检查指定类型的生成任务是否正在运行"""
        if relation_type in self.tasks:
            thread, _, _ = self.tasks[relation_type]
            return thread.is_alive()
        return False

    def stop_generation(self, relation_type: str) -> bool:
        """停止一个生成任务（线程无法强制终止，只能设置停止标志）"""
        if relation_type in self.tasks:
            thread, _, stop_event = self.tasks[relation_type]
            stop_event.set()  # 设置停止标志
            del self.tasks[relation_type]
            with _store_lock:
                if relation_type in _progress_store:
                    _progress_store[relation_type].status = "stopped"
            return True
        return False


def get_progress(relation_type: str) -> Optional[Dict[str, Any]]:
    """获取指定类型的生成进度"""
    with _store_lock:
        if relation_type in _progress_store:
            p = _progress_store[relation_type]
            return {
                "relation_type": p.relation_type,
                "status": p.status,
                "current": p.current,
                "total": p.total,
                "percent": p.percent,
                "message": p.message,
                "error": p.error,
                "total_count": p.total_count
            }
    return None


def get_all_progress() -> Dict[str, Dict[str, Any]]:
    """获取所有任务的进度"""
    with _store_lock:
        return {
            rt: {
                "relation_type": p.relation_type,
                "status": p.status,
                "current": p.current,
                "total": p.total,
                "percent": p.percent,
                "message": p.message,
                "error": p.error,
                "total_count": p.total_count
            }
            for rt, p in _progress_store.items()
        }


def clear_progress(relation_type: str):
    """清除指定类型的进度状态"""
    with _store_lock:
        if relation_type in _progress_store:
            del _progress_store[relation_type]


# 全局管理器实例
_manager: Optional[RelationGenerationManager] = None


def init_manager():
    """初始化全局管理器"""
    global _manager
    _manager = RelationGenerationManager()


def get_manager() -> RelationGenerationManager:
    """获取全局管理器"""
    if _manager is None:
        raise RuntimeError("RelationGenerationManager not initialized. Call init_manager() first.")
    return _manager
