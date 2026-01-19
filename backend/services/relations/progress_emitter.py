# -*- coding: utf-8 -*-
"""
关系生成进度发射器 - 通过进程间通信发送进度
"""
import multiprocessing


class ProgressEmitter:
    """进度发射器 - 用于生成器向主进程发送进度信息"""

    def __init__(self, queue: multiprocessing.Queue = None, relation_type: str = ""):
        self.queue = queue
        self.relation_type = relation_type

    def emit_progress(self, current: int, total: int, message: str = ""):
        """发送进度更新"""
        if self.queue:
            self.queue.put({
                "type": "progress",
                "relation_type": self.relation_type,
                "current": current,
                "total": total,
                "message": message,
                "percent": int((current / total * 100)) if total > 0 else 0
            })

    def emit_complete(self, total_count: int, message: str = ""):
        """发送完成信号"""
        if self.queue:
            self.queue.put({
                "type": "complete",
                "relation_type": self.relation_type,
                "total_count": total_count,
                "message": message
            })

    def emit_error(self, error_message: str):
        """发送错误信号"""
        if self.queue:
            self.queue.put({
                "type": "error",
                "relation_type": self.relation_type,
                "message": error_message
            })
