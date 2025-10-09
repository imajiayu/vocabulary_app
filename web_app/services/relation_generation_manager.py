# -*- coding: utf-8 -*-
"""
关系生成管理器 - 使用线程池 + WebSocket实时推送进度（改进版）

为什么使用线程而不是多进程：
1. SQLAlchemy session 在多进程间无法共享
2. macOS 上 spawn 模式会导致导入失败
3. 关系生成是 IO 密集型（数据库操作），线程足够
"""
import threading
import queue
from typing import Optional
from flask_socketio import SocketIO


# 存储正在运行的生成任务
active_tasks = {}


def _generate_worker(relation_type: str, progress_queue: queue.Queue):
    """
    工作线程函数 - 执行关系生成

    参数:
    - relation_type: 关系类型
    - progress_queue: 线程间通信队列
    """
    try:
        from web_app.services.relations.progress_emitter import ProgressEmitter

        # 创建进度发射器
        emitter = ProgressEmitter(progress_queue, relation_type)

        # 根据类型导入对应的生成器并执行（使用自动增量模式）
        if relation_type == "synonym":
            from web_app.services.relations.synonym_generator import SynonymGenerator
            generator = SynonymGenerator(min_confidence=0.6)
            count = generator.generate_relations(emitter)
        elif relation_type == "antonym":
            from web_app.services.relations.antonym_generator import AntonymGenerator
            generator = AntonymGenerator()
            count = generator.generate_relations(emitter)
        elif relation_type == "root":
            from web_app.services.relations.root_generator import RootRelationGenerator
            generator = RootRelationGenerator(min_confidence=0.8)
            count = generator.generate_relations(emitter)
        elif relation_type == "confused":
            from web_app.services.relations.confused_generator import ConfusedWordsGenerator
            generator = ConfusedWordsGenerator(min_length=5)
            count = generator.generate_relations(emitter)
        elif relation_type == "topic":
            from web_app.services.relations.topic_generator import SemanticTopicGenerator
            generator = SemanticTopicGenerator(min_confidence=0.7)
            count = generator.generate_relations(emitter)
        else:
            raise ValueError(f"Unknown relation type: {relation_type}")

        # 发送完成信号
        emitter.emit_complete(count, f"{relation_type} generation completed")

    except Exception as e:
        # 发送错误信号
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        from web_app.services.relations.progress_emitter import ProgressEmitter
        emitter = ProgressEmitter(progress_queue, relation_type)
        emitter.emit_error(error_msg)


class RelationGenerationManager:
    """关系生成管理器 - 管理多个并发的生成任务（线程版）"""

    def __init__(self, socketio: SocketIO):
        self.socketio = socketio
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
        """监听工作线程发送的进度信息并通过WebSocket推送"""
        while True:
            try:
                # 从队列获取消息（阻塞等待）
                message = progress_queue.get(timeout=1)

                if message["type"] == "progress":
                    # 发送进度更新事件
                    self.socketio.emit("relation_generation_progress", {
                        "relation_type": message["relation_type"],
                        "current": message["current"],
                        "total": message["total"],
                        "percent": message["percent"],
                        "message": message["message"]
                    })

                elif message["type"] == "complete":
                    # 发送完成事件
                    self.socketio.emit("relation_generation_complete", {
                        "relation_type": message["relation_type"],
                        "total_count": message["total_count"],
                        "message": message["message"]
                    })
                    # 完成后退出监听
                    break

                elif message["type"] == "error":
                    # 发送错误事件
                    self.socketio.emit("relation_generation_error", {
                        "relation_type": message["relation_type"],
                        "message": message["message"]
                    })
                    # 错误后退出监听
                    break

            except queue.Empty:
                # 超时，检查线程是否还在运行
                if relation_type in self.tasks:
                    thread, _, _ = self.tasks[relation_type]
                    if not thread.is_alive():
                        # 线程已结束，退出监听
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
            return True
        return False


# 全局管理器实例（需要在app初始化时设置）
_manager: Optional[RelationGenerationManager] = None


def init_manager(socketio: SocketIO):
    """初始化全局管理器"""
    global _manager
    _manager = RelationGenerationManager(socketio)


def get_manager() -> RelationGenerationManager:
    """获取全局管理器"""
    if _manager is None:
        raise RuntimeError("RelationGenerationManager not initialized. Call init_manager() first.")
    return _manager
