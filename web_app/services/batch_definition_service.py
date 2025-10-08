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

    def __init__(self, delay_between_requests=0.5, db_update_callback=None):
        """
        初始化批量释义服务

        Args:
            delay_between_requests: 请求之间的延迟（秒），避免API限流
            db_update_callback: 数据库更新回调函数 callback(word_id, definition_dict) -> bool
        """
        self.task_queue = queue.Queue()
        self.delay = delay_between_requests
        self.db_update_callback = db_update_callback
        self.worker_thread = None
        self.is_running = False

    def start_worker(self):
        """启动工作线程"""
        if self.is_running:
            return

        self.is_running = True
        self.worker_thread = threading.Thread(target=self._worker, daemon=True)
        self.worker_thread.start()
        print("Batch definition worker started")

    def stop_worker(self):
        """停止工作线程"""
        self.is_running = False
        if self.worker_thread:
            self.worker_thread.join(timeout=5)
            print("Batch definition worker stopped")

    def add_task(self, word_id, word_text):
        """
        添加单词释义获取任务到队列

        Args:
            word_id: 单词ID
            word_text: 单词文本
        """
        self.task_queue.put((word_id, word_text))
        # 确保工作线程在运行
        if not self.is_running:
            self.start_worker()

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
                            time.sleep(0.5)
                            continue

                    # 发送WebSocket事件
                    ws_events.emit_word_updated(word_id, definition)
                    print(f"✓ Definition fetched for '{word_text}' (id={word_id})")
                    break  # 成功后退出循环
                else:
                    retry_count += 1
                    print(f"✗ Failed to fetch '{word_text}', retry {retry_count}...")
                    time.sleep(0.5)  # 失败后等待0.5秒再重试

            except Exception as e:
                retry_count += 1
                print(f"✗ Error fetching '{word_text}': {e}, retry {retry_count}...")
                time.sleep(0.5)  # 异常后等待0.5秒再重试


# 全局单例实例
_batch_definition_service = None


def get_batch_definition_service(db_update_callback=None):
    """
    获取批量释义服务的单例实例

    Args:
        db_update_callback: 首次调用时设置的数据库更新回调函数
    """
    global _batch_definition_service
    if _batch_definition_service is None:
        _batch_definition_service = BatchDefinitionService(
            delay_between_requests=0.5,  # 每个请求间隔0.5秒
            db_update_callback=db_update_callback
        )
        _batch_definition_service.start_worker()
    return _batch_definition_service
