# -*- coding: utf-8 -*-
"""
关系生成 API

提供生成/停止/进度查询端点。
"""
import json
import time
import logging

from flask import Blueprint, Response, g, jsonify, request, stream_with_context

from backend.services.generation_service import generation_service
from backend.utils.response import api_success, api_error

logger = logging.getLogger(__name__)

generation_bp = Blueprint("generation", __name__, url_prefix="/api/relations")


@generation_bp.route("/generate", methods=["POST"])
def start_generation():
    """启动关系生成"""
    data = request.get_json(silent=True) or {}
    relation_type = data.get("relation_type")

    if not relation_type:
        return api_error("relation_type is required")

    try:
        started = generation_service.start(relation_type, g.user_id)
    except ValueError as e:
        return api_error(str(e))

    if not started:
        return api_error(f"{relation_type} is already running", 409)

    return api_success({"message": "Generation started"})


@generation_bp.route("/generate/stop", methods=["POST"])
def stop_generation():
    """停止关系生成"""
    data = request.get_json(silent=True) or {}
    relation_type = data.get("relation_type")

    if not relation_type:
        return api_error("relation_type is required")

    stopped = generation_service.stop(relation_type, g.user_id)

    if not stopped:
        return api_error(f"{relation_type} is not running")

    return api_success({"message": "Stop requested"})


@generation_bp.route("/generate/status", methods=["GET"])
def get_status():
    """获取当前用户所有生成任务的状态（非 SSE）"""
    return api_success(generation_service.get_status_for_user(g.user_id))


@generation_bp.route("/generate/progress", methods=["GET"])
def stream_progress():
    """SSE 端点，实时推送当前用户的生成进度"""
    # 在请求上下文中捕获 user_id，生成器函数中使用
    user_id = g.user_id

    def event_stream():
        MAX_IDLE_SECONDS = 300  # 5 分钟无变化则断开
        prev_status = {}
        idle_seconds = 0

        while True:
            current = generation_service.get_status_for_user(user_id)

            # 推送有变化的任务状态
            changed = {}
            for rt, status in current.items():
                if status != prev_status.get(rt):
                    changed[rt] = status

            if changed:
                idle_seconds = 0  # 有变化，重置空闲计时

                # 检查终态事件
                for rt, status in changed.items():
                    s = status["status"]
                    if s in ("completed", "stopped", "error"):
                        event_type = s if s != "error" else "error"
                        yield f"event: {event_type}\ndata: {json.dumps({'relation_type': rt, **status})}\n\n"

                # 汇总进度事件
                running = {
                    rt: st for rt, st in current.items() if st["status"] == "running"
                }
                if running:
                    yield f"event: progress\ndata: {json.dumps(running)}\n\n"
            else:
                idle_seconds += 0.5

            prev_status = current

            # 超时断开：客户端断开后 while True 循环继续运行
            if idle_seconds >= MAX_IDLE_SECONDS:
                yield f"event: done\ndata: {json.dumps({'message': 'idle timeout'})}\n\n"
                break

            # 用已获取的 current 快照判断是否还有活跃任务
            if not any(s["status"] == "running" for s in current.values()):
                yield f"event: done\ndata: {json.dumps({'message': 'no active tasks'})}\n\n"
                break

            time.sleep(0.5)

    return Response(
        stream_with_context(event_stream()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
