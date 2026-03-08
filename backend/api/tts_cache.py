# -*- coding: utf-8 -*-
"""TTS 音频缓存：保存/删除 Google TTS 音频文件到服务器文件系统"""
import base64
import hashlib
import logging
import os
import shutil
import tempfile

from flask import Blueprint, g, request

from backend.utils.response import api_error, api_success

logger = logging.getLogger(__name__)

TTS_CACHE_DIR = os.environ.get("TTS_CACHE_DIR", "/opt/vocabulary_app/tts-cache")

tts_cache_bp = Blueprint("tts_cache", __name__, url_prefix="/api/tts")


def _safe_source(source: str) -> bool:
    """校验 source 是合法目录名（不含路径遍历字符，不是 . 或 ..）"""
    return bool(source) and source not in (".", "..") and "/" not in source and "\\" not in source


@tts_cache_bp.route("/cache", methods=["POST"])
def save_tts_audio():
    """接收 base64 音频数据，保存到文件系统"""
    data = request.get_json(silent=True)
    if not data:
        return api_error("请求体为空", 400)

    word = data.get("word")
    source = data.get("source")
    audio = data.get("audio")

    if not word or not source or not audio:
        return api_error("缺少必要参数: word, source, audio", 400)

    if not _safe_source(source):
        return api_error("无效的 source 参数", 400)

    word_hash = hashlib.sha256(word.encode("utf-8")).hexdigest()
    dir_path = os.path.join(TTS_CACHE_DIR, source)
    file_path = os.path.join(dir_path, f"{word_hash}.mp3")

    # 已存在则跳过
    if os.path.exists(file_path):
        return api_success()

    try:
        os.makedirs(dir_path, exist_ok=True)
        audio_bytes = base64.b64decode(audio)
        # 原子写入：先写临时文件，再 rename，避免 nginx 读到半写文件
        fd, tmp_path = tempfile.mkstemp(dir=dir_path, suffix=".tmp")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(audio_bytes)
            os.rename(tmp_path, file_path)
        except BaseException:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            raise
        logger.info("TTS cache saved: %s/%s.mp3 [%s] (user=%s)", source, word_hash[:8], word, g.user_id)
    except Exception as e:
        logger.error("TTS cache save failed: %s", e)
        return api_error("保存音频失败", 500)

    return api_success()


@tts_cache_bp.route("/cache", methods=["DELETE"])
def delete_tts_audio():
    """删除缓存的 TTS 音频"""
    data = request.get_json(silent=True)
    if not data:
        return api_error("请求体为空", 400)

    source = data.get("source")
    if not source:
        return api_error("缺少必要参数: source", 400)

    if not _safe_source(source):
        return api_error("无效的 source 参数", 400)

    words = data.get("words")
    deleted = 0

    if words:
        # 删除指定单词的缓存文件
        for word in words:
            if not isinstance(word, str):
                continue
            word_hash = hashlib.sha256(word.encode("utf-8")).hexdigest()
            file_path = os.path.join(TTS_CACHE_DIR, source, f"{word_hash}.mp3")
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    deleted += 1
            except OSError as e:
                logger.warning("TTS cache delete failed for %s: %s", file_path, e)
    else:
        # 删除整个 source 目录
        dir_path = os.path.join(TTS_CACHE_DIR, source)
        if os.path.isdir(dir_path):
            try:
                deleted = sum(1 for f in os.listdir(dir_path) if f.endswith(".mp3"))
                shutil.rmtree(dir_path)
            except OSError as e:
                logger.warning("TTS cache dir delete failed for %s: %s", dir_path, e)

    logger.info("TTS cache deleted: source=%s, count=%d (user=%s)", source, deleted, g.user_id)
    return api_success({"deleted": deleted})
