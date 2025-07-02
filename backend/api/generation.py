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

logger = logging.getLogger(__name__)

generation_bp = Blueprint("generation", __name__, url_prefix="/api/relations")


@generation_bp.route("/generate", methods=["POST"])
def start_generation():
    """启动关系生成"""
    data = request.get_json(silent=True) or {}
    relation_type = data.get("relation_type")

    if not relation_type:
        return jsonify({"success": False, "error": "relation_type is required"}), 400

    try:
        started = generation_service.start(relation_type, g.user_id)
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400

    if not started:
        return (
            jsonify({"success": False, "error": f"{relation_type} is already running"}),
            409,
        )

    return jsonify({"success": True, "message": "Generation started"})


@generation_bp.route("/generate/stop", methods=["POST"])
def stop_generation():
    """停止关系生成"""
    data = request.get_json(silent=True) or {}
    relation_type = data.get("relation_type")

    if not relation_type:
        return jsonify({"success": False, "error": "relation_type is required"}), 400

    stopped = generation_service.stop(relation_type, g.user_id)

    if not stopped:
        return jsonify({"success": False, "error": f"{relation_type} is not running"}), 400

    return jsonify({"success": True, "message": "Stop requested"})


@generation_bp.route("/generate/status", methods=["GET"])
def get_status():
    """获取当前用户所有生成任务的状态（非 SSE）"""
    return jsonify({"success": True, "data": generation_service.get_status_for_user(g.user_id)})


@generation_bp.route("/generate/progress", methods=["GET"])
def stream_progress():
    """SSE 端点，实时推送当前用户的生成进度"""
    # 在请求上下文中捕获 user_id，生成器函数中使用
    user_id = g.user_id

    def event_stream():
        prev_status = {}

        while True:
            current = generation_service.get_status_for_user(user_id)

            # 推送有变化的任务状态
            changed = {}
            for rt, status in current.items():
                if status != prev_status.get(rt):
                    changed[rt] = status

            if changed:
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

            prev_status = current

            # 用已获取的 current 快照判断是否还有活跃任务
            # 不能用 has_active_tasks_for_user()：它读取实时状态，与 current 快照存在竞态
            # 如果 current 仍有 running，下轮循环会捕获 completed 并发送终态事件
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
