# -*- coding: utf-8 -*-
"""
Supabase Storage 服务
- 音频文件上传/删除
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
AUDIO_BUCKET = "speaking-audios"

# 延迟初始化客户端
_supabase_client = None


def _get_client():
    """获取 Supabase 客户端（延迟初始化）"""
    global _supabase_client

    if _supabase_client is not None:
        return _supabase_client

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.warning("Supabase Storage credentials not configured")
        return None

    try:
        from supabase import create_client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        return _supabase_client
    except ImportError:
        logger.error("supabase package not installed. Run: pip install supabase")
        return None
    except Exception as e:
        logger.error(f"Failed to create Supabase client: {e}")
        return None


def upload_audio(file_data: bytes, filename: str) -> Optional[str]:
    """
    上传音频文件到 Supabase Storage

    Args:
        file_data: 音频文件的二进制数据
        filename: 文件名（如 recording_1234567890.wav）

    Returns:
        成功返回公开访问 URL，失败返回 None
    """
    client = _get_client()
    if not client:
        return None

    try:
        # 上传文件到 bucket
        client.storage.from_(AUDIO_BUCKET).upload(
            path=filename,
            file=file_data,
            file_options={"content-type": "audio/wav"}
        )

        # 获取公开访问 URL
        public_url = client.storage.from_(AUDIO_BUCKET).get_public_url(filename)
        logger.info(f"Audio uploaded successfully: {filename}")
        return public_url

    except Exception as e:
        logger.error(f"Failed to upload audio '{filename}': {e}")
        return None


def delete_audio(filename: str) -> bool:
    """
    从 Supabase Storage 删除音频文件

    Args:
        filename: 文件名（如 recording_1234567890.wav）

    Returns:
        删除成功返回 True，失败返回 False
    """
    client = _get_client()
    if not client:
        return False

    try:
        client.storage.from_(AUDIO_BUCKET).remove([filename])
        logger.info(f"Audio deleted successfully: {filename}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete audio '{filename}': {e}")
        return False


def extract_filename_from_url(url: str) -> Optional[str]:
    """
    从 Supabase Storage URL 中提取文件名

    Args:
        url: 完整的 Supabase Storage URL

    Returns:
        文件名，如果无法解析则返回 None
    """
    if not url:
        return None

    try:
        # URL 格式: https://xxx.supabase.co/storage/v1/object/public/speaking-audios/filename.wav
        return url.split("/")[-1]
    except Exception:
        return None
