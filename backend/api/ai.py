# -*- coding: utf-8 -*-
"""
外部 AI 代理 — LLM / STT / TTS 三条路由，全部走 OpenAI 兼容协议

上游网关以 `model` 字符串路由到不同供应商（Anthropic / Google / OpenAI / ElevenLabs）。
所有 API key 收敛在 backend/.env:
    AI_BASE_URL      — 网关 base（如 https://aihubmix.com/v1）
    AI_API_KEY       — 唯一 key，三条路由共用
    AI_DEFAULT_MODEL — LLM 兜底 model
    AI_DEFAULT_STT_MODEL / AI_DEFAULT_TTS_MODEL / AI_DEFAULT_TTS_VOICE — 可选兜底

用户级 model 选择在前端 Settings，经 body 传入（frontend/src/shared/services/aiModelPrefs.ts）
"""
import base64
import io
import json
import logging
import os
from typing import Any

import requests
from flask import Blueprint, Response, g, request, stream_with_context

from backend.utils.response import api_error, api_success

logger = logging.getLogger(__name__)

ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")

# /chat/completions 请求体白名单字段
# model 由前端按 caller 从 user_config 解析后传入；缺省兜底 AI_DEFAULT_MODEL
ALLOWED_CHAT_FIELDS = {"model", "messages", "temperature", "max_tokens", "response_format", "stream"}

UPSTREAM_TIMEOUT = 120  # 秒


def _base_url() -> str:
    raw = os.environ.get("AI_BASE_URL")
    if not raw:
        raise RuntimeError("AI_BASE_URL not configured")
    return raw.rstrip("/")


def _api_key() -> str:
    key = os.environ.get("AI_API_KEY")
    if not key:
        raise RuntimeError("AI_API_KEY not configured")
    return key


def _mime_to_filename(mime: str) -> str:
    """按音频 MIME 推断文件名后缀（OpenAI 兼容网关按后缀判断格式）"""
    m = (mime or "").lower()
    if "webm" in m:
        return "audio.webm"
    if "wav" in m:
        return "audio.wav"
    if "mp3" in m:
        return "audio.mp3"
    if "flac" in m:
        return "audio.flac"
    if "ogg" in m:
        return "audio.ogg"
    if "mp4" in m or "m4a" in m:
        return "audio.m4a"
    return "audio.webm"


# ──────────────────────────────────────────────────────────
# /api/ai/chat — LLM 代理 (同步 + 流式)
# ──────────────────────────────────────────────────────────

@ai_bp.route("/chat", methods=["POST"])
def chat():
    try:
        base_url = _base_url()
        api_key = _api_key()
    except RuntimeError as e:
        return api_error(str(e), 500)

    data = request.get_json(silent=True) or {}

    # 白名单过滤
    body: dict[str, Any] = {k: v for k, v in data.items() if k in ALLOWED_CHAT_FIELDS}
    if "messages" not in body or not isinstance(body["messages"], list):
        return api_error("messages 字段必填且必须为数组", 400)

    # model 兜底
    model = body.get("model")
    if not isinstance(model, str) or not model.strip():
        default_model = os.environ.get("AI_DEFAULT_MODEL")
        if not default_model:
            return api_error("AI_DEFAULT_MODEL not configured", 500)
        body["model"] = default_model
    else:
        body["model"] = model.strip()

    stream = bool(body.get("stream"))
    upstream_url = f"{base_url}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    if stream:
        return _stream_chat(upstream_url, headers, body)

    try:
        resp = requests.post(upstream_url, headers=headers, json=body, timeout=UPSTREAM_TIMEOUT)
    except requests.RequestException as e:
        logger.error("AI chat upstream request failed: %s", e)
        return api_error(f"上游请求失败: {e}", 502)

    if not resp.ok:
        logger.warning("AI chat upstream %s: %s", resp.status_code, resp.text[:500])
        return api_error(f"上游返回 {resp.status_code}: {resp.text[:300]}", 502)

    try:
        return api_success(resp.json())
    except ValueError:
        return api_error("上游响应不是合法 JSON", 502)


def _stream_chat(upstream_url: str, headers: dict, body: dict):
    """流式转发：上游 SSE 逐行透传，客户端断开时关闭上游。"""
    try:
        upstream = requests.post(
            upstream_url, headers=headers, json=body, stream=True, timeout=UPSTREAM_TIMEOUT
        )
    except requests.RequestException as e:
        logger.error("AI chat stream upstream request failed: %s", e)

        def err_gen():
            payload = json.dumps({"error": f"上游请求失败: {e}"}, ensure_ascii=False)
            yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"

        return Response(stream_with_context(err_gen()), mimetype="text/event-stream")

    if not upstream.ok:
        status = upstream.status_code
        detail = upstream.text[:300]
        upstream.close()
        logger.warning("AI chat stream upstream %s: %s", status, detail)

        def err_gen():
            payload = json.dumps(
                {"error": f"上游返回 {status}: {detail}"}, ensure_ascii=False
            )
            yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"

        return Response(stream_with_context(err_gen()), mimetype="text/event-stream")

    def sse_gen():
        try:
            for raw_line in upstream.iter_lines(decode_unicode=True):
                if raw_line is None:
                    continue
                yield f"{raw_line}\n\n" if raw_line else "\n"
        except GeneratorExit:
            logger.info("AI chat stream client disconnected (user=%s)", g.user_id)
        finally:
            upstream.close()

    return Response(
        stream_with_context(sse_gen()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ──────────────────────────────────────────────────────────
# /api/ai/transcribe — STT 代理 (OpenAI 兼容 /audio/transcriptions)
# ──────────────────────────────────────────────────────────

@ai_bp.route("/transcribe", methods=["POST"])
def transcribe():
    try:
        base_url = _base_url()
        api_key = _api_key()
    except RuntimeError as e:
        return api_error(str(e), 500)

    data = request.get_json(silent=True) or {}
    audio_b64 = data.get("audio_base64")
    mime_type = data.get("mime_type") or ""
    language_code = data.get("language_code") or "en"
    model = (data.get("model") or "").strip() or os.environ.get("AI_DEFAULT_STT_MODEL")
    if not model:
        return api_error("未指定 STT model 且 AI_DEFAULT_STT_MODEL 未配置", 500)

    if not audio_b64 or not isinstance(audio_b64, str):
        return api_error("audio_base64 必填", 400)

    try:
        audio_bytes = base64.b64decode(audio_b64, validate=True)
    except Exception:
        return api_error("audio_base64 非合法 base64", 400)

    filename = _mime_to_filename(mime_type)
    # OpenAI /audio/transcriptions 用 multipart/form-data
    files = {"file": (filename, io.BytesIO(audio_bytes), mime_type or "application/octet-stream")}
    form: dict[str, str] = {"model": model, "response_format": "json"}
    if language_code:
        form["language"] = language_code

    try:
        resp = requests.post(
            f"{base_url}/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            data=form,
            files=files,
            timeout=UPSTREAM_TIMEOUT,
        )
    except requests.RequestException as e:
        logger.error("STT upstream error: %s", e)
        return api_error(f"STT 上游错误: {e}", 502)

    if not resp.ok:
        return api_error(f"STT 上游返回 {resp.status_code}: {resp.text[:200]}", 502)

    try:
        body = resp.json() or {}
    except ValueError:
        return api_error("STT 上游响应不是合法 JSON", 502)

    # OpenAI 兼容响应：{text: "..."}
    text = body.get("text") if isinstance(body, dict) else None
    if not isinstance(text, str):
        return api_error("STT 响应缺少 text 字段", 502)

    # confidence 在 OpenAI 协议里没有；保留字段形状给前端，置 1.0 占位
    return api_success({"text": text.strip(), "confidence": 1.0})


# ──────────────────────────────────────────────────────────
# /api/ai/synthesize — TTS 代理 (OpenAI 兼容 /audio/speech)
# ──────────────────────────────────────────────────────────

@ai_bp.route("/synthesize", methods=["POST"])
def synthesize():
    try:
        base_url = _base_url()
        api_key = _api_key()
    except RuntimeError as e:
        return api_error(str(e), 500)

    data = request.get_json(silent=True) or {}
    text_val = data.get("text")
    model = (data.get("model") or "").strip() or os.environ.get("AI_DEFAULT_TTS_MODEL")
    voice = (data.get("voice") or "").strip() or os.environ.get("AI_DEFAULT_TTS_VOICE", "alloy")
    response_format = data.get("response_format") or "mp3"

    if not text_val or not isinstance(text_val, str):
        return api_error("text 必填", 400)
    if not model:
        return api_error("未指定 TTS model 且 AI_DEFAULT_TTS_MODEL 未配置", 500)

    payload: dict[str, Any] = {
        "model": model,
        "input": text_val,
        "voice": voice,
        "response_format": response_format,
    }

    try:
        resp = requests.post(
            f"{base_url}/audio/speech",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=UPSTREAM_TIMEOUT,
        )
    except requests.RequestException as e:
        logger.error("TTS upstream error: %s", e)
        return api_error(f"TTS 上游错误: {e}", 502)

    if not resp.ok:
        return api_error(f"TTS 上游返回 {resp.status_code}: {resp.text[:200]}", 502)

    # OpenAI /audio/speech 返回音频二进制（Content-Type: audio/mpeg 等）
    audio_bytes = resp.content
    if not audio_bytes:
        return api_error("TTS 上游返回空音频", 502)

    mime_map = {"mp3": "audio/mpeg", "wav": "audio/wav", "flac": "audio/flac", "opus": "audio/opus"}
    mime = mime_map.get(response_format, resp.headers.get("Content-Type", "audio/mpeg"))

    audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
    return api_success({"audio_base64": audio_b64, "mime": mime})
