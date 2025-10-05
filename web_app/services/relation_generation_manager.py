# -*- coding: utf-8 -*-
"""
关系生成管理器 - 使用多进程 + WebSocket实时推送进度
"""
import multiprocessing
from typing import List, Optional
from flask_socketio import SocketIO


# 存储正在运行的生成任务
active_tasks = {}


def _generate_worker(relation_type: str, queue: multiprocessing.Queue):
    """
    子进程工作函数 - 执行关系生成

    参数:
    - relation_type: 关系类型
    - queue: 进程间通信队列
    """
    try:
        from web_app.services.relations.progress_emitter import ProgressEmitter

        # 创建进度发射器
        emitter = ProgressEmitter(queue, relation_type)

        # 根据类型导入对应的生成器并执行
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
            generator = ConfusedWordsGenerator(min_length=4)
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
        from web_app.services.relations.progress_emitter import ProgressEmitter
        emitter = ProgressEmitter(queue, relation_type)
        emitter.emit_error(str(e))


class RelationGenerationManager:
    """关系生成管理器 - 管理多个并发的生成任务"""

    def __init__(self, socketio: SocketIO):
        self.socketio = socketio
        self.tasks = {}  # {relation_type: (process, queue)}

    def start_generation(self, relation_type: str) -> bool:
        """
        启动一个生成任务

        返回:
        - True: 成功启动
        - False: 该类型已经在运行中
        """
        # 检查是否已经在运行
        if relation_type in self.tasks:
            process, _ = self.tasks[relation_type]
            if process.is_alive():
                return False

        # 创建进程间通信队列
        queue = multiprocessing.Queue()

        # 创建并启动子进程
        process = multiprocessing.Process(
            target=_generate_worker,
            args=(relation_type, queue)
        )
        process.start()

        # 保存任务信息
        self.tasks[relation_type] = (process, queue)

        # 启动队列监听器（在单独线程中）
        import threading
        listener_thread = threading.Thread(
            target=self._listen_progress,
            args=(relation_type, queue),
            daemon=True
        )
        listener_thread.start()

        return True

    def _listen_progress(self, relation_type: str, queue: multiprocessing.Queue):
        """监听子进程发送的进度信息并通过WebSocket推送"""
        while True:
            try:
                # 从队列获取消息（阻塞等待）
                message = queue.get(timeout=1)

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

            except Exception as e:
                # 超时或其他错误，检查进程是否还在运行
                if relation_type in self.tasks:
                    process, _ = self.tasks[relation_type]
                    if not process.is_alive():
                        # 进程已结束，退出监听
                        break
                else:
                    break

        # 清理任务
        if relation_type in self.tasks:
            del self.tasks[relation_type]

    def is_running(self, relation_type: str) -> bool:
        """检查指定类型的生成任务是否正在运行"""
        if relation_type in self.tasks:
            process, _ = self.tasks[relation_type]
            return process.is_alive()
        return False

    def stop_generation(self, relation_type: str) -> bool:
        """停止一个生成任务"""
        if relation_type in self.tasks:
            process, queue = self.tasks[relation_type]
            if process.is_alive():
                process.terminate()
                process.join(timeout=5)
                if process.is_alive():
                    process.kill()
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
