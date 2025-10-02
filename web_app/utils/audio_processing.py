# -*- coding: utf-8 -*-
"""
音频处理模块 - 简化的PCM16数据处理和音频格式转换
"""
import base64
import os
import subprocess
import tempfile
from typing import Optional
from pathlib import Path


class AudioProcessor:
    """简化的音频处理器，只处理PCM16数据"""

    def __init__(self, session_id: str = None):
        """初始化音频处理器"""
        self.session_id = session_id

    def process_pcm16_chunk(self, audio_data: str) -> Optional[bytes]:
        """处理PCM16音频块"""
        try:
            # 解码base64 PCM16数据
            pcm16_bytes = base64.b64decode(audio_data)
            print(f"处理PCM16数据块: {len(pcm16_bytes)}字节")
            return pcm16_bytes
        except Exception as e:
            print(f"处理PCM16音频出错: {e}")
            return None

    def close_pcm_file(self) -> None:
        """兼容性方法，保持接口一致"""
        pass


def convert_m4a_to_wav(input_file_path: str, output_file_path: str = None) -> str:
    """
    将M4A文件转换为WAV格式

    Args:
        input_file_path: 输入的M4A文件路径
        output_file_path: 输出的WAV文件路径，如果为None则自动生成

    Returns:
        str: 转换后的WAV文件路径

    Raises:
        Exception: 转换失败时抛出异常
    """
    if not os.path.exists(input_file_path):
        raise FileNotFoundError(f"输入文件不存在: {input_file_path}")

    # 如果没有指定输出路径，则生成一个
    if output_file_path is None:
        input_path = Path(input_file_path)
        output_file_path = str(input_path.with_suffix('.wav'))

    try:
        # 使用ffmpeg进行转换
        cmd = [
            'ffmpeg',
            '-i', input_file_path,
            '-acodec', 'pcm_s16le',  # 16-bit PCM
            '-ar', '16000',          # 16kHz采样率
            '-ac', '1',              # 单声道
            '-y',                    # 覆盖输出文件
            output_file_path
        ]

        print(f"转换音频格式: {input_file_path} -> {output_file_path}")

        # 执行转换命令
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30  # 30秒超时
        )

        if result.returncode != 0:
            raise Exception(f"ffmpeg转换失败: {result.stderr}")

        # 验证输出文件是否存在
        if not os.path.exists(output_file_path):
            raise Exception("转换完成但输出文件不存在")

        print(f"音频转换成功: {output_file_path}")
        return output_file_path

    except subprocess.TimeoutExpired:
        raise Exception("音频转换超时")
    except FileNotFoundError:
        raise Exception("ffmpeg未安装或不在PATH中")
    except Exception as e:
        # 清理可能创建的输出文件
        if output_file_path and os.path.exists(output_file_path):
            try:
                os.remove(output_file_path)
            except:
                pass
        raise Exception(f"音频转换失败: {str(e)}")


def convert_audio_file_to_wav(file_obj, original_filename: str) -> str:
    """
    将上传的音频文件转换为WAV格式

    Args:
        file_obj: 文件对象
        original_filename: 原始文件名

    Returns:
        str: 转换后的WAV文件路径
    """
    # 创建临时目录
    temp_dir = tempfile.mkdtemp()

    try:
        # 保存原始文件
        input_path = os.path.join(temp_dir, original_filename)
        file_obj.save(input_path)

        # 生成输出文件路径
        base_name = Path(original_filename).stem
        output_path = os.path.join(temp_dir, f"{base_name}.wav")

        # 转换为WAV
        return convert_m4a_to_wav(input_path, output_path)

    except Exception as e:
        # 清理临时文件
        try:
            import shutil
            shutil.rmtree(temp_dir)
        except:
            pass
        raise e
