# -*- coding: utf-8 -*-
"""
WebSocket 实时音频转录服务 - 简化版
"""
import time
from flask_socketio import emit
from flask import request
from web_app.extensions import socketio
from web_app.utils.audio_processing import AudioProcessor
from web_app.utils.whisper_integration import WhisperProcessor
from web_app.services.websocket_events import ws_events

# 存储连接的会话信息
active_sessions = {}


class AudioTranscriptionSession:
    """简化的音频转录会话"""

    def __init__(self, session_id):
        self.session_id = session_id
        self.audio_chunks_count = 0
        self.transcribed_text = ""
        self.start_time = time.time()

        # 初始化音频处理器
        self.audio_processor = AudioProcessor(session_id=session_id)
        self.whisper_processor = None

    def start_whisper_session(self):
        """启动Whisper转录会话"""
        if self.whisper_processor:
            return True

        def transcription_callback(text):
            """转录结果回调"""
            if text.strip():
                self.transcribed_text += text.strip() + " "
                # 使用统一的事件发送器
                ws_events.emit_transcription_update(
                    self.session_id,
                    text.strip(),
                    self.transcribed_text.strip(),
                    self.audio_chunks_count
                )

        try:
            self.whisper_processor = WhisperProcessor(transcription_callback)
            if self.whisper_processor.start():
                print(f"✅ Whisper会话启动成功: {self.session_id}")
                return True
            else:
                print(f"❌ Whisper会话启动失败: {self.session_id}")
                self.whisper_processor = None
                return False
        except Exception as e:
            print(f"启动Whisper会话出错: {e}")
            self.whisper_processor = None
            return False

    def stop_whisper_session(self):
        """停止Whisper转录会话"""
        if self.whisper_processor:
            self.whisper_processor.stop()
            self.whisper_processor = None
            print(f"Whisper会话已停止: {self.session_id}")

        self.audio_processor.close_pcm_file()

    def process_audio_chunk(self, audio_data):
        """处理音频数据块"""
        try:
            self.audio_chunks_count += 1
            print(f"📡 处理音频块 {self.audio_chunks_count}")

            # 处理PCM16数据
            pcm16_data = self.audio_processor.process_pcm16_chunk(audio_data)

            if pcm16_data and self.whisper_processor:
                return self.whisper_processor.send_audio_chunk(pcm16_data)
            else:
                return False

        except Exception as e:
            print(f"处理音频数据出错: {e}")
            return False


@socketio.on("connect")
def handle_connect():
    """客户端连接处理"""
    try:
        session_id = request.sid
        print(f"WebSocket客户端已连接: {session_id}")
        # 不在连接时立即发送事件，等待连接完全建立
    except Exception as e:
        print(f"连接处理时出错: {e}")
        # 对于连接错误，不返回任何值，让SocketIO处理


@socketio.on("disconnect")
def handle_disconnect():
    """客户端断开连接处理"""
    try:
        session_id = request.sid
        print(f"客户端断开连接: {session_id}")

        if session_id in active_sessions:
            session = active_sessions[session_id]
            # 停止Whisper会话
            session.stop_whisper_session()
            # 清理会话
            del active_sessions[session_id]
            print(f"已清理会话: {session_id}")
        else:
            print(f"会话不存在，无需清理: {session_id}")

    except Exception as e:
        print(f"断开连接处理时出错: {e}")

    # 不返回任何值，避免WSGI错误


@socketio.on("start_transcription")
def handle_start_transcription(data=None):
    """开始转录会话"""
    _ = data  # 忽略未使用的参数
    session_id = request.sid

    # 检查是否已有活跃会话
    if session_id in active_sessions:
        ws_events.emit_transcription_started(session_id, "already_started", "转录会话已存在")
        print(f"转录会话已存在: {session_id}")
        return

    # 创建新的转录会话并立即启动Whisper
    session = AudioTranscriptionSession(session_id)

    # 立即启动Whisper会话
    if session.start_whisper_session():
        active_sessions[session_id] = session
        ws_events.emit_transcription_started(session_id, "started", "转录会话已开始")
        print(f"转录会话已启动: {session_id}")
    else:
        ws_events.emit_error("启动Whisper转录服务失败", session_id)
        print(f"启动转录会话失败: {session_id}")


@socketio.on("stop_transcription")
def handle_stop_transcription(data=None):
    """停止转录会话"""
    _ = data  # 忽略未使用的参数
    session_id = request.sid

    if session_id in active_sessions:
        session = active_sessions[session_id]
        final_text = session.transcribed_text.strip()

        # 停止Whisper会话
        session.stop_whisper_session()

        # 清理会话
        del active_sessions[session_id]

        print(f"停止转录会话: {session_id}, 最终文本: {final_text}")
        ws_events.emit_transcription_stopped(session_id, final_text, session.audio_chunks_count)
    else:
        ws_events.emit_error("没有找到活跃的转录会话", session_id)


@socketio.on("audio_chunk")
def handle_audio_chunk(data):
    """处理音频数据块"""
    session_id = request.sid

    if session_id not in active_sessions:
        ws_events.emit_error("没有活跃的转录会话", session_id)
        return

    session = active_sessions[session_id]

    try:
        # 获取音频数据
        audio_data = data.get("audio_data")
        if not audio_data:
            ws_events.emit_error("缺少音频数据", session_id)
            return

        # 处理音频数据
        if session.process_audio_chunk(audio_data):
            ws_events.emit_chunk_processed(session_id, session.audio_chunks_count, time.time())
        else:
            ws_events.emit_error("处理音频数据失败", session_id)

    except Exception as e:
        print(f"处理音频块出错: {e}")
        ws_events.emit_error(f"处理音频数据出错: {str(e)}", session_id)


@socketio.on("get_session_status")
def handle_get_session_status():
    """获取会话状态"""
    session_id = request.sid

    if session_id in active_sessions:
        session = active_sessions[session_id]
        ws_events.emit_session_status(
            session_id,
            True,
            session.audio_chunks_count,
            session.transcribed_text.strip(),
            time.time() - session.start_time,
            session.whisper_processor is not None
        )
    else:
        ws_events.emit_session_status(session_id, False)


def cleanup_all_sessions():
    """清理所有活跃的会话"""
    try:
        session_ids = list(active_sessions.keys())
        for session_id in session_ids:
            session = active_sessions[session_id]
            session.stop_whisper_session()
            del active_sessions[session_id]
            print(f"清理会话: {session_id}")
        print("所有会话已清理完成")
    except Exception as e:
        print(f"清理会话出错: {e}")


# 注册应用关闭时的清理函数
import atexit

atexit.register(cleanup_all_sessions)
