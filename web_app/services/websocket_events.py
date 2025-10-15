# -*- coding: utf-8 -*-
"""
统一的WebSocket事件管理模块
集中管理所有WebSocket事件的发送和处理
"""
from typing import Dict, Any, Optional
import time
from web_app.extensions import socketio


class WebSocketEvents:
    """WebSocket事件管理类"""

    # 事件类型常量
    class Events:
        # 单词相关事件
        WORD_UPDATED = "wordUpdated"
        WORD_CREATED = "wordCreated"
        WORD_DELETED = "wordDeleted"

        # 语音转录相关事件
        TRANSCRIPTION_UPDATE = "transcription_update"
        TRANSCRIPTION_STARTED = "transcription_started"
        TRANSCRIPTION_STOPPED = "transcription_stopped"
        CHUNK_PROCESSED = "chunk_processed"

        # 复习参数更新事件
        REVIEW_PARAMS_UPDATED = "review_params_updated"

        # 通用事件
        ERROR = "error"
        CONNECTED = "connected"
        SESSION_STATUS = "session_status"

    @staticmethod
    def emit_word_updated(
        word_id: int, definition: Dict[str, Any], room: Optional[str] = None
    ):
        """发送单词更新事件"""
        data = {"id": word_id, "definition": definition, "timestamp": time.time()}
        socketio.emit(WebSocketEvents.Events.WORD_UPDATED, data, room=room)

    @staticmethod
    def emit_word_created(word: Dict[str, Any], room: Optional[str] = None):
        """发送单词创建事件"""
        socketio.emit(WebSocketEvents.Events.WORD_CREATED, word, room=room)

    @staticmethod
    def emit_word_deleted(word_id: int, room: Optional[str] = None):
        """发送单词删除事件"""
        data = {"id": word_id}
        socketio.emit(WebSocketEvents.Events.WORD_DELETED, data, room=room)

    @staticmethod
    def emit_transcription_update(
        session_id: str, text: str, accumulated_text: str, chunk_count: int
    ):
        """发送转录更新事件"""
        data = {
            "text": text,
            "accumulated_text": accumulated_text,
            "chunk_count": chunk_count,
        }
        socketio.emit(WebSocketEvents.Events.TRANSCRIPTION_UPDATE, data, to=session_id)

    @staticmethod
    def emit_transcription_started(session_id: str, status: str, message: str):
        """发送转录开始事件"""
        data = {
            "status": status,
            "session_id": session_id,
            "message": message,
        }
        socketio.emit(WebSocketEvents.Events.TRANSCRIPTION_STARTED, data, to=session_id)

    @staticmethod
    def emit_transcription_stopped(
        session_id: str, final_text: str, chunks_processed: int
    ):
        """发送转录停止事件"""
        data = {
            "status": "stopped",
            "final_text": final_text,
            "chunks_processed": chunks_processed,
        }
        socketio.emit(WebSocketEvents.Events.TRANSCRIPTION_STOPPED, data, to=session_id)

    @staticmethod
    def emit_chunk_processed(session_id: str, chunk_count: int, timestamp: float):
        """发送音频块处理完成事件"""
        data = {"chunk_count": chunk_count, "timestamp": timestamp}
        socketio.emit(WebSocketEvents.Events.CHUNK_PROCESSED, data, to=session_id)

    @staticmethod
    def emit_error(
        message: str, session_id: Optional[str] = None, room: Optional[str] = None
    ):
        """发送错误事件"""
        data = {"message": message}
        if session_id:
            socketio.emit(WebSocketEvents.Events.ERROR, data, to=session_id)
        else:
            socketio.emit(WebSocketEvents.Events.ERROR, data, room=room)

    @staticmethod
    def emit_connected(session_id: str):
        """发送连接成功事件"""
        data = {"status": "connected", "session_id": session_id}
        socketio.emit(WebSocketEvents.Events.CONNECTED, data, to=session_id)

    @staticmethod
    def emit_session_status(
        session_id: str,
        active: bool,
        chunks_processed: int = 0,
        accumulated_text: str = "",
        duration: float = 0,
        whisper_active: bool = False,
    ):
        """发送会话状态事件"""
        data = {
            "active": active,
            "session_id": session_id,
            "chunks_processed": chunks_processed,
            "accumulated_text": accumulated_text,
            "duration": duration,
            "whisper_active": whisper_active,
        }
        socketio.emit(WebSocketEvents.Events.SESSION_STATUS, data, to=session_id)

    @staticmethod
    def emit_review_params_updated(
        word: str,
        param_type: str,
        param_change: float,
        new_param_value: float,
        next_review_date: str,
        room: Optional[str] = None,
        breakdown: Optional[Dict[str, Any]] = None
    ):
        """发送复习参数更新事件

        Args:
            word: 单词本身
            param_type: 参数类型 ('ease_factor' 或 'spell_strength')
            param_change: 参数变化量（正数表示增加，负数表示减少）
            new_param_value: 新的参数值
            next_review_date: 下次复习日期（ISO格式字符串）
            room: 房间ID（可选，用于广播）
            breakdown: 评分详情（可选，仅用于拼写）
        """
        data = {
            "word": word,
            "paramType": param_type,
            "paramChange": param_change,
            "newParamValue": new_param_value,
            "nextReviewDate": next_review_date,
            "timestamp": time.time()
        }
        if breakdown:
            data["breakdown"] = breakdown
        socketio.emit(WebSocketEvents.Events.REVIEW_PARAMS_UPDATED, data, room=room)


# 便捷的全局事件发送器实例
ws_events = WebSocketEvents()
