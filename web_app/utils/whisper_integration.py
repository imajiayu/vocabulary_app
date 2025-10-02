# -*- coding: utf-8 -*-
"""
Whisper.cpp集成模块 - 基于test_pcm_stream.py的简化实现
"""
import subprocess
import threading
import queue
import time
import select
from typing import Callable


class WhisperProcessor:
    """简化的Whisper处理器，基于test_pcm_stream.py的成功实现"""

    def __init__(self, transcription_callback: Callable[[str], None]):
        self.transcription_callback = transcription_callback
        self.process = None
        self.is_running = False
        self.output_queue = queue.Queue()
        self.stop_reading = threading.Event()

        # Whisper配置
        self.whisper_binary = "./whisper.cpp/build/bin/whisper-stream-stdin"
        self.model_path = "./whisper.cpp/models/ggml-small.bin"

        # 输出处理状态
        self.current_line_content = ""
        self.accumulated_text = ""
        self.is_line_active = False

    def start(self) -> bool:
        """启动Whisper进程"""
        if self.is_running:
            return True

        try:
            cmd = [
                self.whisper_binary,
                "-m",
                self.model_path,
                "-t",
                "8",
                "--step",
                "500",
                "--length",
                "5000",
                "-l",
                "en",
                "--no-timestamps",
            ]

            print(f"启动Whisper: {' '.join(cmd)}")

            self.process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=False,
                bufsize=0,
            )

            self.is_running = True
            self.stop_reading.clear()

            # 启动输出读取线程
            threading.Thread(target=self._read_output, daemon=True).start()
            threading.Thread(target=self._display_output, daemon=True).start()

            print("✅ Whisper启动成功")
            return True

        except Exception as e:
            print(f"启动Whisper失败: {e}")
            return False

    def stop(self) -> None:
        """停止Whisper进程"""
        self.is_running = False
        self.stop_reading.set()

        # 如果有未输出的当前行内容，在停止前输出
        if self.current_line_content.strip():
            self._output_sentence(self.current_line_content)

        if self.process:
            try:
                if self.process.stdin and not self.process.stdin.closed:
                    self.process.stdin.close()

                try:
                    self.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.process.kill()
                    self.process.wait(timeout=2)

                print("Whisper进程已停止")
            except Exception as e:
                print(f"停止Whisper进程出错: {e}")

            self.process = None

        # 重置输出处理状态
        self._reset_current_line()
        self.accumulated_text = ""

    def send_audio_chunk(self, pcm16_data: bytes) -> bool:
        """发送音频块到Whisper"""
        if not self.is_running or not self.process or not self.process.stdin:
            return False

        try:
            self.process.stdin.write(pcm16_data)
            self.process.stdin.flush()
            return True
        except (BrokenPipeError, OSError, ValueError):
            print("Whisper stdin断开")
            self.stop()
            return False

    def _read_output(self):
        """实时读取输出的线程"""
        try:
            while not self.stop_reading.is_set() and self.process:
                if self.process.stdout:
                    ready, _, _ = select.select([self.process.stdout], [], [], 0.1)
                    if ready:
                        line = self.process.stdout.readline()
                        if line:
                            self.output_queue.put(line.decode("utf-8", errors="ignore"))
                        else:
                            break
                time.sleep(0.1)
        except Exception as e:
            print(f"读取输出出错: {e}")

    def _display_output(self):
        """显示实时输出的线程"""
        while not self.stop_reading.is_set() or not self.output_queue.empty():
            try:
                data = self.output_queue.get(timeout=0.5)
                self._process_whisper_line(data)
            except queue.Empty:
                continue

    def _process_whisper_line(self, raw_line: str):
        """处理whisper输出的单行数据"""
        # 调试：显示原始行数据
        print(f"📥 原始行: {repr(raw_line[:100])}...")  # 只显示前100字符

        # 检查是否包含换行符（真正的句子结束标志）
        has_newline = raw_line.endswith("\n")

        # 按控制字符拆分，获取最后的有效内容
        latest_content = self._extract_latest_content(raw_line)
        print(f"🔍 提取的最新内容: {repr(latest_content)}")

        if has_newline:
            # 有换行符 - 句子结束，输出最终内容
            if latest_content.strip():
                print(f"🏁 句子结束，输出最终内容: {latest_content}")
                self._output_sentence(latest_content)
            else:
                # 换行但没有内容，可能是空行，输出之前累积的内容
                if self.current_line_content.strip():
                    print(f"🏁 空行结束，输出累积内容: {self.current_line_content}")
                    self._output_sentence(self.current_line_content)
            self._reset_current_line()
        else:
            # 没有换行符 - 更新当前行内容
            if latest_content.strip():
                self.current_line_content = latest_content
                self.is_line_active = True
                print(f"🔄 识别中: {latest_content}")

    def _extract_latest_content(self, raw_line: str) -> str:
        """从原始行中提取最新的有效内容"""
        # 按控制字符序列拆分
        parts = raw_line.split("\x1b[2K\r")

        # 从后往前找第一个有效内容
        for part in reversed(parts):
            # 清理这个部分
            clean_part = part.replace("\r", "").replace("\n", "").strip()
            # 过滤标记
            filtered_part = self._filter_transcription_text(clean_part)

            if filtered_part.strip():
                return filtered_part

        return ""

    def _clean_line(self, line: str) -> str:
        """清理行数据，去除控制字符"""
        import re

        # 去除ANSI控制字符
        clean = re.sub(r"\x1b\[[0-9;]*[mKH]", "", line)
        # 去除回车和多余空格
        clean = clean.replace("\r", "").strip()
        return clean

    def _output_sentence(self, text: str):
        """输出完整句子"""
        if not text.strip():
            return

        # 去重检查
        if self._is_duplicate(text):
            return

        # 更新累积文本
        self.accumulated_text += text.strip() + " "

        # 发送给回调
        if self.transcription_callback:
            print(f"🎙️ 完整转录: {text.strip()}")
            self.transcription_callback(text.strip())

    def _reset_current_line(self):
        """重置当前行状态"""
        self.current_line_content = ""
        self.is_line_active = False

    def _is_duplicate(self, new_text: str) -> bool:
        """检查是否为重复内容"""
        new_text = new_text.strip()
        if not new_text:
            return True

        # 检查是否与已累积文本重复
        accumulated_lower = self.accumulated_text.lower().strip()
        new_lower = new_text.lower()

        # 完全相同
        if new_lower in accumulated_lower:
            return True

        # 检查是否为已有文本的后缀（可能是重复输出）
        if accumulated_lower.endswith(new_lower):
            return True

        return False

    def _filter_transcription_text(self, text: str) -> str:
        """过滤转录文本，去除[]和()包裹的内容"""
        import re

        # 去除[]包裹的内容（如[BLANK_AUDIO]、[MUSIC]等）
        text = re.sub(r"\[.*?\]", "", text)

        # 去除()包裹的内容（如(music)、(noise)等）
        text = re.sub(r"\(.*?\)", "", text)

        # 清理多余的空格
        text = " ".join(text.split())

        return text.strip()
