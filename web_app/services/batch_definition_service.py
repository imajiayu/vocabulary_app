"""
批量释义获取服务 - 使用队列避免并发过多
"""
import queue
import threading
import time
from web_app.services.vocabulary_service import fetch_definition_from_web
from web_app.services.websocket_events import ws_events


class BatchDefinitionService:
    """批量获取单词释义的服务，使用队列控制并发"""

    def __init__(self, delay_between_requests=0.2, db_update_callback=None, num_workers=5):
        """
        初始化批量释义服务

        Args:
            delay_between_requests: 请求之间的延迟（秒），避免API限流
            db_update_callback: 数据库更新回调函数 callback(word_id, definition_dict) -> bool
            num_workers: 并发工作线程数量（默认5个）
        """
        self.task_queue = queue.Queue()
        self.delay = delay_between_requests
        self.db_update_callback = db_update_callback
        self.worker_threads = []
        self.num_workers = num_workers
        self.is_running = False

        # 正在处理或等待处理的单词ID集合（用于去重）
        self.processing_word_ids = set()
        self.processing_lock = threading.Lock()  # 保护集合的线程锁

    def start_worker(self):
        """启动多个工作线程"""
        if self.is_running:
            return

        self.is_running = True
        for i in range(self.num_workers):
            worker_thread = threading.Thread(target=self._worker, daemon=True, name=f"DefinitionWorker-{i+1}")
            worker_thread.start()
            self.worker_threads.append(worker_thread)
        print(f"Batch definition service started with {self.num_workers} workers")

    def stop_worker(self):
        """停止所有工作线程"""
        self.is_running = False
        for worker in self.worker_threads:
            if worker.is_alive():
                worker.join(timeout=5)
        self.worker_threads.clear()
        print("All batch definition workers stopped")

    def add_task(self, word_id, word_text):
        """
        添加单词释义获取任务到队列（自动去重）

        Args:
            word_id: 单词ID
            word_text: 单词文本

        Returns:
            bool: True表示成功添加，False表示已存在（跳过）
        """
        with self.processing_lock:
            # 检查是否已在处理队列中
            if word_id in self.processing_word_ids:
                print(f"⊘ Word '{word_text}' (id={word_id}) already in queue, skipping")
                return False

            # 添加到处理集合
            self.processing_word_ids.add(word_id)

        # 添加到队列
        self.task_queue.put((word_id, word_text))
        print(f"+ Word '{word_text}' (id={word_id}) added to queue, total: {len(self.processing_word_ids)}")

        # 确保工作线程在运行
        if not self.is_running:
            self.start_worker()

        return True

    def get_queue_size(self):
        """
        获取当前队列大小（包括正在处理和等待处理的任务）

        Returns:
            int: 队列中的任务数量
        """
        with self.processing_lock:
            return len(self.processing_word_ids)

    def _worker(self):
        """工作线程，从队列中取出任务并处理"""
        print("Batch definition worker running...")

        while self.is_running:
            try:
                # 使用超时避免阻塞
                word_id, word_text = self.task_queue.get(timeout=1)

                # 处理任务
                self._process_task(word_id, word_text)

                # 标记任务完成
                self.task_queue.task_done()

                # 请求间延迟，避免API限流
                time.sleep(self.delay)

            except queue.Empty:
                # 队列为空，继续等待
                continue
            except Exception as e:
                print(f"Worker error processing {word_text}: {e}")

    def _process_task(self, word_id, word_text):
        """
        处理单个单词的释义获取任务，持续重试直到成功

        Args:
            word_id: 单词ID
            word_text: 单词文本
        """
        retry_count = 0

        try:
            while True:
                try:
                    # 获取释义
                    definition = fetch_definition_from_web(word_text)

                    if definition:
                        # 使用回调函数更新数据库（避免循环引用）
                        if self.db_update_callback:
                            success = self.db_update_callback(word_id, definition)
                            if not success:
                                retry_count += 1
                                print(f"✗ DB update failed for '{word_text}', retry {retry_count}...")
                                time.sleep(0.3)
                                continue

                        # 获取当前队列大小（包括正在处理的任务）
                        # 注意：此时当前任务还在 processing_word_ids 中，所以要减1
                        with self.processing_lock:
                            queue_size = len(self.processing_word_ids) - 1

                        # 发送WebSocket事件，包含队列大小
                        ws_events.emit_word_updated(word_id, definition, queue_size=queue_size)
                        print(f"✓ Definition fetched for '{word_text}' (id={word_id}), remaining: {queue_size}")
                        break  # 成功后退出循环
                    else:
                        retry_count += 1
                        print(f"✗ Failed to fetch '{word_text}', retry {retry_count}...")
                        time.sleep(0.3)  # 失败后等待0.3秒再重试

                except Exception as e:
                    retry_count += 1
                    print(f"✗ Error fetching '{word_text}': {e}, retry {retry_count}...")
                    time.sleep(0.3)  # 异常后等待0.3秒再重试

        finally:
            # 无论成功还是失败，最终都要从处理集合中移除
            with self.processing_lock:
                self.processing_word_ids.discard(word_id)
                print(f"- Word '{word_text}' (id={word_id}) removed from queue, remaining: {len(self.processing_word_ids)}")


# 全局单例实例
_batch_definition_service = None


def get_batch_definition_service(db_update_callback=None):
    """
    获取批量释义服务的单例实例

    Args:
        db_update_callback: 首次调用时设置的数据库更新回调函数
    """
    from web_app.config import UserConfig

    global _batch_definition_service
    if _batch_definition_service is None:
        _batch_definition_service = BatchDefinitionService(
            delay_between_requests=0.2,  # 每个请求间隔0.2秒（降低延迟）
            db_update_callback=db_update_callback,
            num_workers=UserConfig.DEFINITION_FETCH_THREADS  # 从配置读取线程数
        )
        _batch_definition_service.start_worker()
    return _batch_definition_service
