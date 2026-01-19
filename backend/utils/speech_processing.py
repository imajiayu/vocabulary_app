"""
语音转录工具模块
直接处理WAV格式音频文件进行语音转录
"""

import os
import subprocess
import tempfile
import json
from typing import Dict
from backend.config import BASE_DIR


class SpeechTranscriber:
    """语音转录器，负责WAV格式音频文件的语音识别"""

    def __init__(self):
        self.whisper_cpp_path = BASE_DIR + "/whisper.cpp/build/bin/whisper-cli"
        self.model_path = BASE_DIR + "/whisper.cpp/models/ggml-small.bin"

    def transcribe_audio_file(self, audio_file, max_size_mb: int = 50) -> Dict:
        """
        处理WAV音频文件转录

        Args:
            audio_file: 上传的WAV音频文件对象
            max_size_mb: 最大文件大小限制(MB)

        Returns:
            Dict: 包含success, text, error的结果字典
        """
        try:
            # 检查文件大小
            audio_file.seek(0, 2)
            file_size = audio_file.tell()
            audio_file.seek(0)

            max_size = max_size_mb * 1024 * 1024
            if file_size > max_size:
                return {
                    "success": False,
                    "text": "",
                    "error": f"文件过大，最大限制: {max_size_mb}MB",
                }

            # 创建临时文件处理
            with tempfile.TemporaryDirectory() as temp_dir:
                # 临时WAV文件路径
                temp_wav = os.path.join(temp_dir, "audio.wav")

                try:
                    # 保存WAV文件
                    audio_file.save(temp_wav)

                    # 验证音频文件
                    if not self.validate_audio_file(temp_wav):
                        return {
                            "success": False,
                            "text": "",
                            "error": "无效的音频文件格式",
                        }

                    # 转换为whisper.cpp需要的格式
                    temp_whisper_wav = os.path.join(temp_dir, "whisper_optimized.wav")
                    if not self.convert_to_wav_for_whisper(temp_wav, temp_whisper_wav):
                        return {
                            "success": False,
                            "text": "",
                            "error": "音频格式转换失败",
                        }

                    # 进行语音转录
                    return self.run_whisper_transcription(temp_whisper_wav)

                except Exception as e:
                    return {
                        "success": False,
                        "text": "",
                        "error": f"音频处理失败: {str(e)}",
                    }

        except Exception as e:
            return {"success": False, "text": "", "error": f"语音转录失败: {str(e)}"}

    def convert_to_wav_for_whisper(self, input_path: str, output_path: str) -> bool:
        """
        为whisper.cpp优化的音频转换函数
        转换为16kHz, 16-bit, mono WAV格式

        Args:
            input_path: 输入音频文件路径
            output_path: 输出WAV文件路径

        Returns:
            bool: 转换是否成功
        """
        try:
            cmd = [
                "ffmpeg",
                "-i",
                input_path,
                "-acodec",
                "pcm_s16le",  # 16位PCM
                "-ar",
                "16000",  # 16kHz采样率（whisper优化）
                "-ac",
                "1",  # 单声道
                "-af",
                "highpass=f=200,lowpass=f=3000,volume=1.5",  # 音频预处理
                "-f",
                "wav",  # WAV格式
                "-y",  # 覆盖输出文件
                "-v",
                "quiet",  # 静默模式
                output_path,
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

            if result.returncode == 0:
                if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
                    return True
                return False
            return False
        except Exception:
            return False

    def run_whisper_transcription(self, wav_path: str) -> Dict:
        """
        运行whisper.cpp进行语音转录

        Args:
            wav_path: WAV文件路径

        Returns:
            Dict: 包含success, text, error的结果字典
        """
        try:
            cmd = [
                self.whisper_cpp_path,
                "-m",
                self.model_path,
                "-f",
                wav_path,
                "-t",
                "8",  # CPU线程数
                "-l",
                "auto",  # 自动检测语言
                "-nt",  # 不输出时间戳
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

            if result.returncode == 0:
                text = self.parse_whisper_output(result.stdout)
                return {"success": True, "text": text, "error": None}
            else:
                return {
                    "success": False,
                    "text": "",
                    "error": result.stderr or "Unknown whisper.cpp error",
                }

        except subprocess.TimeoutExpired:
            return {"success": False, "text": "", "error": "Whisper转录超时"}
        except FileNotFoundError:
            return {
                "success": False,
                "text": "",
                "error": "whisper.cpp可执行文件未找到",
            }
        except Exception as e:
            return {"success": False, "text": "", "error": f"Whisper转录错误: {str(e)}"}

    def parse_whisper_output(self, stdout: str) -> str:
        """
        解析whisper.cpp的输出文本

        Args:
            stdout: whisper.cpp的标准输出

        Returns:
            str: 提取的转录文本
        """
        try:
            lines = stdout.strip().splitlines()

            # 由于使用了 -nt 参数（无时间戳），输出应该是纯文本
            # 过滤掉空行和可能的调试信息
            text_lines = []
            for line in lines:
                line = line.strip()
                if not line:
                    continue

                # 跳过可能的调试输出或进度信息
                if (
                    line.startswith("whisper_")
                    or line.startswith("load_model")
                    or line.startswith("processing")
                    or "ms" in line
                    and ("load" in line or "compute" in line)
                ):
                    continue

                # 添加实际的转录文本
                text_lines.append(line)

            # 合并所有文本行
            full_text = " ".join(text_lines).strip()
            return full_text

        except Exception:
            return stdout.strip()

    def validate_audio_file(self, file_path: str) -> bool:
        """
        验证音频文件是否有效

        Args:
            file_path: 音频文件路径

        Returns:
            bool: 文件是否有效
        """
        try:
            # 检查文件是否存在且不为空
            if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
                return False

            cmd = [
                "ffprobe",
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                file_path,
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)

            if result.returncode == 0:
                try:
                    info = json.loads(result.stdout)
                    # 检查是否包含音频流
                    for stream in info.get("streams", []):
                        if stream.get("codec_type") == "audio":
                            duration = float(stream.get("duration", "0"))
                            codec_name = stream.get("codec_name", "")

                            # 检查时长或编解码器
                            if (
                                duration > 0 and 0.1 <= duration <= 600
                            ) or codec_name in [
                                "opus",
                                "vorbis",
                                "aac",
                                "mp3",
                                "pcm_s16le",
                            ]:
                                return True
                except (json.JSONDecodeError, ValueError, TypeError):
                    pass
            return False

        except Exception:
            return False


# 创建全局实例
def create_speech_transcriber() -> SpeechTranscriber:
    """创建语音转录器实例"""
    return SpeechTranscriber()
