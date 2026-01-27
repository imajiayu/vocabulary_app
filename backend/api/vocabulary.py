import json
import logging
import random
from flask import Blueprint, jsonify, request, session, g
from flask_cors import CORS

logger = logging.getLogger(__name__)

from backend.database.vocabulary_dao import (
    db_delete_word,
    db_fetch_today_spell,
    db_get_word_review_info,
    db_get_words_review_info_batch,
    db_insert_word,
    db_update_word,
    db_fetch_review_word_ids,
    db_fetch_lapse_word_ids,
    db_fetch_spelled_word_ids,
    db_get_source_stats_from_view,
)
# 已迁移到前端 Supabase 查询（不再需要）:
# - db_fetch_word_info
# - db_fetch_word_info_for_insert_page
# - db_fetch_word_info_paginated
from backend.services.vocabulary_service import get_bold_definition
from backend.const import (
    MODE_REVIEW,
    MODE_LAPSE,
    MODE_SPELLING,
    SESSION_KEY_SNAPSHOT,
)
from backend.services.word_update_service import (
    update_word_info_lapse,
    update_word_info_review,
    update_word_info_spelling,
    # 分离式 API（计算与持久化解耦）
    calculate_review_result,
    persist_review_result,
    calculate_spelling_result,
    persist_spelling_result,
)
# 进度管理已迁移到前端直连 Supabase，以下导入不再需要:
# from backend.services.progress_service import (
#     save_word_ids_snapshot,
#     update_current_progress_index,
#     get_progress_info,
#     update_lapse_progress_after_word_update,
#     get_progress_restore_data,
#     clear_progress,
# )

api_bp = Blueprint("api", __name__, url_prefix="/api")

CORS(api_bp, origins="*")


def create_response(success=True, data=None, message=""):
    """创建统一的API响应格式"""
    return jsonify({"success": success, "data": data, "message": message})


def fetch_word_ids_by_mode(mode=MODE_REVIEW, limit=None, user_id=1):
    """Simplified word ID fetching by mode"""
    if mode == MODE_REVIEW:
        return db_fetch_review_word_ids(limit, user_id=user_id)
    elif mode == MODE_LAPSE:
        return db_fetch_lapse_word_ids(limit, user_id=user_id)
    elif mode == MODE_SPELLING:
        return db_fetch_spelled_word_ids(limit, user_id=user_id)
    else:
        return []


@api_bp.route("/source", methods=["GET"])
def get_source():
    """Get the current source filter from session."""
    from backend.config import UserConfig

    config = UserConfig(g.user_id)
    # 默认使用第一个可用的 source
    default_source = config.CUSTOM_SOURCES[0] if config.CUSTOM_SOURCES else "IELTS"
    current_source = session.get("current_source", default_source)
    return create_response(
        True,
        {"current_source": current_source},
        "Current source retrieved successfully",
    )


@api_bp.route("/source", methods=["POST"])
def set_source():
    """Set the current source filter and save to session."""
    from backend.config import UserConfig

    config = UserConfig(g.user_id)
    data = request.get_json()
    if not data or "source" not in data:
        return create_response(False, None, "Missing source parameter"), 400

    source = data["source"]
    # 动态验证：检查是否在 CUSTOM_SOURCES 中
    if source not in config.CUSTOM_SOURCES:
        return create_response(
            False, None, f"Invalid source. Must be one of: {config.CUSTOM_SOURCES}"
        ), 400

    session["current_source"] = source
    return create_response(True, {"current_source": source}, "Source set successfully")


# Shuffle API已移除 - shuffle现在是config.py中的设置项
# 通过 /api/settings 接口进行修改

@api_bp.route("/index_summary", methods=["GET"])
def get_index_summary():
    """Simple summary for the modern index page.

    Uses word_source_stats view for efficient single-query statistics.
    Only returns current source data - use /source_stats/<source> for other sources.

    Note: progress_restore 已迁移到前端直连 Supabase，此端点不再返回进度信息。
    """
    try:
        from backend.config import UserConfig

        user_id = g.user_id
        config = UserConfig(user_id)
        available_sources = config.CUSTOM_SOURCES or ["IELTS", "GRE"]

        # 获取当前 source
        current_source = session.get("current_source", available_sources[0])

        # 从 view 获取当前 source 的统计数据（按用户过滤）
        stats = db_get_source_stats_from_view(current_source, user_id)

    except Exception as e:
        return (
            create_response(False, None, f"Failed to get index summary: {str(e)}"),
            500,
        )

    return create_response(
        True,
        {
            "counts": stats["counts"],
            "source_stats": {current_source: stats["source_stats"]},
            "current_source": current_source,
            # progress_restore 已迁移到前端直连 Supabase
        },
        "Index summary retrieved successfully",
    )


# ============================================================================
# 已迁移到前端 Supabase 直接查询的端点（已删除）:
# - GET /words - 使用 WordsApi.getWordsDirect()
# - GET /words/paginated - 使用 WordsApi.getWordsPaginatedDirect()
# - GET /word/<id> - 使用 WordsApi.getWordDirect()
# ============================================================================


@api_bp.route("/word", methods=["POST"])
def insert_words():
    data = request.get_json()
    if not data or "word" not in data:
        return create_response(False, None, "缺少参数 word"), 400

    word = data["word"].strip().lower()
    source = data["source"]
    user_id = g.user_id
    if not word or not source:
        return create_response(False, None, "单词不能为空"), 400

    try:
        new_word = db_insert_word(word, source, user_id)
        if new_word is None:
            return create_response(False, None, f"单词 '{word}' 已存在"), 400

        # 释义获取已改为前端同步调用 POST /words/<id>/fetch-definition
        return create_response(True, new_word, "Word inserted successfully")
    except Exception as e:
        logger.error(f"Failed to insert word '{word}': {e}")
        return create_response(False, None, f"插入失败: {str(e)}"), 500


@api_bp.route("/words/batch", methods=["POST"])
def batch_insert_words():
    """批量导入单词"""
    from backend.config import UserConfig

    config = UserConfig(g.user_id)
    data = request.get_json()
    if not data or "words" not in data or "source" not in data:
        return create_response(False, None, "缺少参数 words 或 source"), 400

    words_list = data["words"]
    source = data["source"]

    if not isinstance(words_list, list) or not words_list:
        return create_response(False, None, "words 必须是非空数组"), 400

    # 动态验证：检查是否在 CUSTOM_SOURCES 中
    if source not in config.CUSTOM_SOURCES:
        return create_response(
            False, None, f"source 必须是以下之一: {config.CUSTOM_SOURCES}"
        ), 400

    success_count = 0
    failed_count = 0
    failed_words = []
    failed_details = []  # 存储失败详情
    inserted_words = []

    # 释义获取已改为前端同步调用 POST /words/<id>/fetch-definition

    for word_text in words_list:
        word_text = word_text.strip().lower()
        if not word_text:
            continue

        try:
            new_word = db_insert_word(word_text, source, g.user_id)
            if new_word:
                success_count += 1
                inserted_words.append(new_word)
            else:
                failed_count += 1
                failed_words.append(word_text)
        except Exception as e:
            logger.error(f"Failed to insert word '{word_text}': {e}")
            failed_count += 1
            failed_words.append(word_text)

    # 构建对齐的失败详情消息
    if failed_words:
        # 找到最长的单词长度
        max_word_length = max(len(word) for word in failed_words)
        # 为每个失败的单词生成对齐的消息
        for word_text in failed_words:
            # 计算需要填充的空格数，空格在引号外
            spaces = " " * (max_word_length - len(word_text))
            failed_details.append(f"单词 '{word_text}'{spaces} 已存在或插入失败")

    # 构建消息：包含成功/失败统计和所有失败详情
    message_parts = [f"批量导入完成：成功 {success_count}，失败 {failed_count}"]
    if failed_details:
        message_parts.append("\n" + "\n".join(failed_details))

    return create_response(
        True,
        {
            "success_count": success_count,
            "failed_count": failed_count,
            "failed_words": failed_words,  # 返回所有失败的单词
            "failed_details": failed_details,  # 返回所有失败详情
            "total": len(words_list),
            "inserted_words": inserted_words,  # 返回插入的单词列表
        },
        "\n".join(message_parts),
    )


@api_bp.route("/word/<int:word_id>", methods=["DELETE"])
def delete_word(word_id):
    try:
        if not db_delete_word(word_id, g.user_id):
            return create_response(False, None, f"未找到单词 (id={word_id})"), 404
        return create_response(True, None, f"单词已删除 (id={word_id})")
    except Exception as e:
        return create_response(False, None, f"Failed to delete word: {str(e)}"), 500


@api_bp.route("/words/batch-delete", methods=["POST"])
def batch_delete_words():
    """批量删除单词，包括相关的关系和生成日志"""
    try:
        data = request.get_json()
        if not data or "word_ids" not in data:
            return create_response(False, None, "缺少参数 word_ids"), 400

        word_ids = data["word_ids"]
        if not isinstance(word_ids, list) or not word_ids:
            return create_response(False, None, "word_ids 必须是非空数组"), 400

        # 验证所有 word_ids 都是整数
        if not all(isinstance(wid, int) for wid in word_ids):
            return create_response(False, None, "所有 word_ids 必须是整数"), 400

        from backend.database.vocabulary_dao import db_batch_delete_words

        deleted_count = db_batch_delete_words(word_ids, g.user_id)

        return create_response(
            True,
            {"deleted_count": deleted_count, "requested_count": len(word_ids)},
            f"成功删除 {deleted_count} 个单词及其相关数据",
        )
    except Exception as e:
        return create_response(False, None, f"批量删除失败: {str(e)}"), 500


@api_bp.route("/words/batch-update", methods=["PATCH"])
def batch_update_words():
    """批量更新单词字段（不传递mode，不影响进度）"""
    try:
        # 1. 检查有效的 JSON 内容类型
        if not request.is_json:
            return (
                create_response(False, None, "Content-Type必须是 'application/json'"),
                400,
            )

        # 2. 解析 JSON 请求体
        data = request.get_json()

        # 3. 验证必需参数
        if not data or "word_ids" not in data:
            return create_response(False, None, "缺少参数 word_ids"), 400

        word_ids = data["word_ids"]
        if not isinstance(word_ids, list) or not word_ids:
            return create_response(False, None, "word_ids 必须是非空数组"), 400

        # 验证所有 word_ids 都是整数
        if not all(isinstance(wid, int) for wid in word_ids):
            return create_response(False, None, "所有 word_ids 必须是整数"), 400

        # 4. 定义允许更新的字段
        allowed_fields = [
            "word",
            "definition",
            "stop_review",
            "next_review",
            "repetition",
            "interval",
            "ease_factor",
            "lapse",
        ]

        # 过滤传入的数据，只包含允许的字段
        update_data = {
            key: value
            for key, value in data.items()
            if key in allowed_fields and key != "word_ids"
        }

        # 5. 检查是否提供了任何有效字段
        if not update_data:
            return create_response(False, None, "未提供有效的更新字段"), 400

        # 6. 调用批量更新函数
        from backend.database.vocabulary_dao import db_batch_update_words

        updated_count, updated_words = db_batch_update_words(word_ids, update_data, g.user_id)

        return create_response(
            True,
            {
                "updated_count": updated_count,
                "requested_count": len(word_ids),
                "words": updated_words,
            },
            f"成功更新 {updated_count} 个单词",
        )
    except Exception as e:
        return create_response(False, None, f"批量更新失败: {str(e)}"), 500


@api_bp.route("/word/<int:word_id>", methods=["PATCH"])
def update_word(word_id):
    try:
        # 1. 检查有效的 JSON 内容类型
        if not request.is_json:
            return (
                create_response(False, None, "Content-Type必须是 'application/json'"),
                400,
            )

        # 2. 解析 JSON 请求体
        data = request.get_json()

        # 3. 定义允许更新的字段，以防止恶意修改
        allowed_fields = [
            "word",
            "definition",
            "stop_review",
            "next_review",
            "repetition",
            "interval",
            "ease_factor",
            "lapse",
        ]

        # 过滤传入的数据，只包含允许的字段
        update_data = {
            key: value for key, value in data.items() if key in allowed_fields
        }

        # 4. 检查是否提供了任何有效字段
        if not update_data:
            return create_response(False, None, "未提供有效的更新字段。"), 400

        if update_data.get("word") and update_data.get("definition"):
            # 如果 definition 是 dict，先序列化为 JSON 字符串
            definition = update_data["definition"]
            if isinstance(definition, dict):
                definition = json.dumps(definition, ensure_ascii=False)
            update_data["definition"] = get_bold_definition(
                update_data["word"], definition
            )

        # 5. 调用数据库更新函数，并获取完整的更新后对象
        message, code, updated_word = db_update_word(word_id, update_data, g.user_id)

        if code == 200:
            # 进度索引更新已迁移到前端直连 Supabase

            # 6. 将完整的 updated_word 对象作为响应返回
            return create_response(True, updated_word, "Word updated successfully")
        else:
            # 7. 如果失败，仍然返回错误信息
            return create_response(False, None, message), code
    except Exception as e:
        return create_response(False, None, f"Failed to update word: {str(e)}"), 500


def apply_shuffle_logic(word_ids, mode, shuffle_enabled):
    """Apply shuffle logic based on mode and shuffle setting."""
    if mode == MODE_LAPSE:
        # For lapse mode: no shuffle logic on backend, return original order
        # Frontend will handle dynamic shuffle logic as words are removed from queue
        return word_ids

    if not shuffle_enabled:
        # No shuffle: sort by id (ascending) for non-lapse modes
        return sorted(word_ids)
    else:
        # Shuffle enabled: shuffle all words for non-lapse modes
        shuffled_ids = word_ids.copy()
        random.shuffle(shuffled_ids)
        return shuffled_ids


@api_bp.route("/words/review", methods=["GET"])
def get_review_words():
    """获取复习单词列表

    进度保存已迁移到前端直连 Supabase，此端点仅负责获取单词数据。
    支持 word_ids 参数用于恢复进度时直接传递快照 ID。
    """
    try:
        # 获取参数
        mode = request.args.get("mode", "mode_review")
        batch_size = int(request.args.get("batch_size", 20))
        offset = int(request.args.get("offset", 0))
        batch_id = int(request.args.get("batch_id", 0))
        limit = request.args.get("limit", None)
        # 新增：支持前端传递 word_ids（用于恢复进度）
        word_ids_param = request.args.get("word_ids", None)

        # 获取shuffle设置
        from backend.config import get_shuffle_setting

        shuffle_enabled = get_shuffle_setting()

        user_id = g.user_id

        # 第一次请求，batch_id=0 - 创建新的快照
        if batch_id == 0:
            all_ids = fetch_word_ids_by_mode(mode, limit, user_id)  # 获取所有单词ID

            # Apply shuffle logic
            all_ids = apply_shuffle_logic(all_ids, mode, shuffle_enabled)

            # 进度保存已迁移到前端，只保存到 session（用于当前请求分页）
            session[SESSION_KEY_SNAPSHOT] = all_ids
        elif word_ids_param:
            # 前端传递了 word_ids（恢复进度场景）
            try:
                all_ids = json.loads(word_ids_param)
                session[SESSION_KEY_SNAPSHOT] = all_ids
            except json.JSONDecodeError:
                all_ids = session.get(SESSION_KEY_SNAPSHOT, [])
        else:
            # 从 session 获取快照
            all_ids = session.get(SESSION_KEY_SNAPSHOT, [])

        # 分页
        paginated_ids = all_ids[offset : offset + batch_size]

        # 批量获取单词数据 - 解决N+1查询问题
        words = db_get_words_review_info_batch(paginated_ids, user_id)

        # 是否有更多
        has_more = offset + batch_size < len(all_ids)

        return create_response(
            True,
            {"words": words, "total": len(all_ids), "has_more": has_more},
            "Review words retrieved successfully",
        )
    except Exception as e:
        return (
            create_response(False, None, f"Failed to get review words: {str(e)}"),
            500,
        )


@api_bp.route("/words/<int:word_id>/result", methods=["PATCH"])
def update_review_word(word_id):
    """更新单词复习结果

    进度索引更新已迁移到前端直连 Supabase。
    """
    try:
        data = request.get_json()
        if not data:
            return create_response(False, None, "Missing request body"), 400

        remembered = bool(data.get("remembered", False))
        elapsed_time = data.get("elapsed_time")
        is_spelling = bool(data.get("is_spelling", False))
        spelling_data = data.get("spelling_data")
        # 从请求中获取mode，默认为MODE_REVIEW
        mode = data.get("mode", MODE_REVIEW)

        # 通知数据（复习/拼写模式会返回，lapse模式不返回）
        notification_data = None
        user_id = g.user_id

        if not is_spelling:
            # 根据模式更新
            if mode == MODE_REVIEW:
                notification_data = update_word_info_review(word_id, remembered, elapsed_time, user_id)
            elif mode == MODE_LAPSE:
                update_word_info_lapse(word_id, remembered, user_id)
        else:
            if mode == MODE_SPELLING:
                notification_data = update_word_info_spelling(word_id, remembered, spelling_data, user_id)

        updated_word = db_get_word_review_info(word_id, user_id)

        # 进度索引更新已迁移到前端直连 Supabase

        # 构建响应数据，包含更新后的单词和通知数据
        response_data = {
            "word": updated_word,
            "notification": notification_data,  # 复习/拼写模式有通知，lapse模式为None
        }

        return create_response(
            True, response_data, "Word review result updated successfully"
        )
    except Exception as e:
        return (
            create_response(False, None, f"Failed to update word result: {str(e)}"),
            500,
        )


# ============================================================================
# 分离式 API：计算与持久化解耦，优化响应速度
# ============================================================================


@api_bp.route("/words/<int:word_id>/calculate-result", methods=["POST"])
def calculate_word_result(word_id):
    """
    只计算复习/拼写结果，不写数据库。
    用于快速返回 notification 数据，前端可立即显示。

    Request body:
        - remembered: bool
        - elapsed_time: float (复习模式)
        - is_spelling: bool
        - spelling_data: dict (拼写模式)
        - mode: str
        - word_data: dict (可选，前端传来的完整 word 数据，用于跳过数据库查询)

    Response:
        - notification: 前端显示用的通知数据
        - persist_data: 需要传给 persist-result 接口的数据
    """
    try:
        data = request.get_json()
        if not data:
            return create_response(False, None, "Missing request body"), 400

        remembered = bool(data.get("remembered", False))
        is_spelling = bool(data.get("is_spelling", False))
        mode = data.get("mode", MODE_REVIEW)
        word_data = data.get("word_data")  # 前端传来的完整 word 数据
        user_id = g.user_id

        result = None

        if not is_spelling and mode == MODE_REVIEW:
            elapsed_time = data.get("elapsed_time")
            result = calculate_review_result(word_id, remembered, elapsed_time, word_data, user_id)
        elif is_spelling and mode == MODE_SPELLING:
            spelling_data = data.get("spelling_data")
            result = calculate_spelling_result(word_id, remembered, spelling_data, word_data, user_id)
        else:
            # lapse 模式不支持分离式 API（无 notification）
            return create_response(False, None, "Mode not supported for calculate-result"), 400

        if not result:
            return create_response(False, None, "Word not found"), 404

        return create_response(True, result, "Calculation completed")

    except Exception as e:
        logger.error(f"Failed to calculate word result: {e}")
        return create_response(False, None, f"Failed to calculate: {str(e)}"), 500


@api_bp.route("/words/<int:word_id>/persist-result", methods=["POST"])
def persist_word_result(word_id):
    """
    持久化复习/拼写结果到数据库。
    由前端在显示 notification 后异步调用（fire-and-forget）。

    进度索引更新已迁移到前端直连 Supabase。

    Request body:
        - persist_data: calculate-result 返回的 persist_data
        - mode: str
        - is_spelling: bool
    """
    try:
        data = request.get_json()
        if not data:
            return create_response(False, None, "Missing request body"), 400

        persist_data = data.get("persist_data")
        mode = data.get("mode", MODE_REVIEW)
        is_spelling = bool(data.get("is_spelling", False))

        if not persist_data:
            return create_response(False, None, "Missing persist_data"), 400

        user_id = g.user_id

        # 执行持久化
        if not is_spelling and mode == MODE_REVIEW:
            persist_review_result(persist_data, user_id)
        elif is_spelling and mode == MODE_SPELLING:
            persist_spelling_result(persist_data, user_id)
        else:
            return create_response(False, None, "Mode not supported"), 400

        # 进度索引更新已迁移到前端直连 Supabase

        # 获取更新后的单词信息
        updated_word = db_get_word_review_info(word_id, user_id)

        return create_response(True, {"word": updated_word}, "Persisted successfully")

    except Exception as e:
        logger.error(f"Failed to persist word result: {e}")
        return create_response(False, None, f"Failed to persist: {str(e)}"), 500


# ============================================================================
# 已迁移到前端直连 Supabase 的端点（已删除）:
# - GET /progress/restore - 使用 ProgressApi.getRestoreDataDirect()
# - POST /progress/clear - 使用 ProgressApi.clearProgressDirect()
# ============================================================================


@api_bp.route("/words/<int:word_id>/fetch-definition", methods=["POST"])
def fetch_word_definition(word_id):
    """同步获取单词释义

    从网络爬取单词释义并更新数据库，返回更新后的完整单词对象。
    用于替代原有的异步队列+轮询模式。

    优化：使用轻量级查询验证存在性（2次完整查询 → 1次轻量 + 1次完整）

    Returns:
        更新后的完整单词对象
    """
    from backend.services.vocabulary_service import fetch_definition_from_web
    from backend.database.vocabulary.word_crud import db_update_word_definition_only
    from backend.database.vocabulary.word_query import db_get_word_review_info, db_get_word_text_only

    user_id = g.user_id

    try:
        # 1. 轻量查询验证存在性并获取单词文本
        word_basic = db_get_word_text_only(word_id, user_id)
        if not word_basic:
            return create_response(False, None, "Word not found"), 404

        # 2. 从网络获取释义
        definition = fetch_definition_from_web(word_basic["word"])
        if not definition:
            return create_response(False, None, "Failed to fetch definition from web"), 500

        # 3. 更新数据库
        success = db_update_word_definition_only(word_id, definition, user_id)
        if not success:
            return create_response(False, None, "Failed to update definition in database"), 500

        # 4. 返回更新后的完整单词
        updated_word = db_get_word_review_info(word_id, user_id)
        return create_response(True, updated_word, "Definition fetched successfully")

    except Exception as e:
        return (
            create_response(False, None, f"Failed to fetch definition: {str(e)}"),
            500,
        )
