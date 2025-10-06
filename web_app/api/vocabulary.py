from collections import Counter
import threading
import random
from flask import Blueprint, jsonify, request, session
from flask_cors import CORS

from web_app.database.vocabulary_dao import (
    db_delete_word,
    db_fetch_today_spell,
    db_fetch_word_info,
    db_fetch_word_info_for_insert_page,
    db_fetch_word_info_paginated,
    db_get_comprehensive_stats,
    db_get_word_review_info,
    db_get_words_review_info_batch,
    db_insert_word,
    db_update_word,
    update_word_definition,
    db_fetch_review_word_ids,
    db_fetch_lapse_word_ids,
    db_fetch_spelled_word_ids,
)
from web_app.services.vocabulary_service import get_bold_definition
from web_app.const import (
    MODE_REVIEW,
    MODE_LAPSE,
    MODE_SPELLING,
    SESSION_KEY_SNAPSHOT,
)
from web_app.services.word_update_service import (
    update_word_info_lapse,
    update_word_info_review,
    update_word_info_spelling,
)
from web_app.services.progress_service import (
    save_word_ids_snapshot,
    update_current_progress_index,
    get_progress_info,
    update_lapse_progress_after_word_update,
    get_progress_restore_data,
)

api_bp = Blueprint("api", __name__, url_prefix="/api")

CORS(api_bp, origins="*")


def create_response(success=True, data=None, message=""):
    """创建统一的API响应格式"""
    return jsonify({"success": success, "data": data, "message": message})


def fetch_word_ids_by_mode(mode=MODE_REVIEW, limit=None):
    """Simplified word ID fetching by mode"""
    if mode == MODE_REVIEW:
        return db_fetch_review_word_ids(limit)
    elif mode == MODE_LAPSE:
        return db_fetch_lapse_word_ids(limit)
    elif mode == MODE_SPELLING:
        return db_fetch_spelled_word_ids(limit)
    else:
        return []


@api_bp.route("/stats", methods=["GET"])
def get_stats():
    """Optimized stats endpoint using single comprehensive query"""
    try:
        # Get source parameter from query string
        source = request.args.get("source", "IELTS")  # Default to IELTS

        # Get all stats in a single database query
        stats = db_get_comprehensive_stats(source=source)

        # Process next_review data
        next_review_counter = Counter(stats["next_reviews"])
        sorted_next_review_dict = {
            date.isoformat(): next_review_counter[date]
            for date in sorted(next_review_counter.keys())
        }

        # Process spell_next_review data
        spell_next_review_counter = Counter(stats["spell_next_reviews"])
        sorted_spell_next_review_dict = {
            date.isoformat(): spell_next_review_counter[date]
            for date in sorted(spell_next_review_counter.keys())
        }

        # Process elapse_time data
        elapse_time_counter = Counter(stats["elapse_times"])
        sorted_elapse_time_dict = {
            time: elapse_time_counter[time]
            for time in sorted(elapse_time_counter.keys())
        }

        # Process review_count data
        review_count_counter = Counter(stats["review_counts"])
        sorted_review_count_dict = {
            count: review_count_counter[count]
            for count in sorted(review_count_counter.keys())
        }

        return create_response(
            True,
            {
                "ef_dict": stats["ef_data"],
                "next_review_dict": sorted_next_review_dict,
                "spell_next_review_dict": sorted_spell_next_review_dict,
                "elapse_time_dict": sorted_elapse_time_dict,
                "spell_strength_dict": stats["spell_strengths"],
                "added_date_count_dict": stats["added_dates"],
                "review_count_dict": sorted_review_count_dict,
                "spell_heatmap_cells": stats["spell_heatmap_cells"],
                "ef_heatmap_cells": stats["ef_heatmap_cells"],
            },
            "Statistics retrieved successfully",
        )

    except Exception as e:
        return (
            create_response(False, None, f"Failed to retrieve statistics: {str(e)}"),
            500,
        )


@api_bp.route("/switch_source", methods=["POST"])
def switch_source():
    """Switch the current source filter and save to session."""
    data = request.get_json()
    if not data or "source" not in data:
        return create_response(False, None, "Missing source parameter"), 400

    source = data["source"]
    if source not in ["IELTS", "GRE"]:
        return create_response(False, None, "Invalid source. Must be IELTS or GRE"), 400

    session["current_source"] = source
    return create_response(True, {"source": source}, "Source switched successfully")


@api_bp.route("/source", methods=["GET"])
def get_source():
    """Get the current source filter from session."""
    current_source = session.get("current_source", "IELTS")
    return create_response(
        True,
        {"current_source": current_source},
        "Current source retrieved successfully",
    )


@api_bp.route("/source", methods=["POST"])
def set_source():
    """Set the current source filter and save to session."""
    data = request.get_json()
    if not data or "source" not in data:
        return create_response(False, None, "Missing source parameter"), 400

    source = data["source"]
    if source not in ["IELTS", "GRE"]:
        return create_response(False, None, "Invalid source. Must be IELTS or GRE"), 400

    session["current_source"] = source
    return create_response(True, {"current_source": source}, "Source set successfully")


@api_bp.route("/shuffle", methods=["GET"])
def get_shuffle():
    """Get the current shuffle setting from session."""
    shuffle = session.get("shuffle", False)
    return create_response(
        True, {"shuffle": shuffle}, "Shuffle setting retrieved successfully"
    )


@api_bp.route("/shuffle", methods=["POST"])
def set_shuffle():
    """Set the current shuffle setting and save to session."""
    data = request.get_json()
    if not data or "shuffle" not in data:
        return create_response(False, None, "Missing shuffle parameter"), 400

    shuffle = bool(data["shuffle"])
    session["shuffle"] = shuffle
    return create_response(
        True, {"shuffle": shuffle}, "Shuffle setting saved successfully"
    )


@api_bp.route("/index_summary", methods=["GET"])
def get_index_summary():
    """Simple summary for the modern index page.

    Returns counts for each mode so the frontend can display numbers without
    using server-side templates.
    """
    try:
        count_review = len(fetch_word_ids_by_mode(MODE_REVIEW))
        count_lapse = len(fetch_word_ids_by_mode(MODE_LAPSE))
        # spelling with no limit -> full candidate count
        count_spelling = len(fetch_word_ids_by_mode(MODE_SPELLING))
        count_today_spell = len(db_fetch_today_spell())

        # Get source statistics
        from web_app.database.vocabulary_dao import db_get_source_statistics

        source_stats = db_get_source_statistics()

        # 获取进度恢复信息
        progress_info = get_progress_info()

    except Exception as e:
        return (
            create_response(False, None, f"Failed to get index summary: {str(e)}"),
            500,
        )

    return create_response(
        True,
        {
            "counts": {
                "review": count_review,
                "lapse": count_lapse,
                "spelling": count_spelling,
                "today_spell": count_today_spell,
            },
            "source_stats": source_stats,
            "current_source": session.get("current_source", "IELTS"),
            "progress_restore": {
                "has_progress": progress_info.get("has_progress", False),
                "summary": progress_info.get("summary", None),
                "progress_basic": (
                    {
                        "mode": progress_info.get("progress", {}).get("mode"),
                        "source": progress_info.get("progress", {}).get("source"),
                        "current_index": progress_info.get("progress", {}).get(
                            "current_index"
                        ),
                    }
                    if progress_info.get("has_progress")
                    else None
                ),
            },
        },
        "Index summary retrieved successfully",
    )


@api_bp.route("/words", methods=["GET"])
def get_words():
    try:
        words = db_fetch_word_info_for_insert_page()
        return create_response(True, words, "Words retrieved successfully")
    except Exception as e:
        return create_response(False, None, f"Failed to retrieve words: {str(e)}"), 500


@api_bp.route("/words/paginated", methods=["GET"])
def get_words_paginated():
    try:
        limit = int(request.args.get("limit", 50))
        offset = int(request.args.get("offset", 0))

        # Validate parameters
        if limit <= 0 or limit > 200:
            return create_response(False, None, "Limit must be between 1 and 200"), 400
        if offset < 0:
            return create_response(False, None, "Offset must be non-negative"), 400

        result = db_fetch_word_info_paginated(limit, offset)
        return create_response(True, result, "Paginated words retrieved successfully")
    except ValueError:
        return create_response(False, None, "Invalid limit or offset parameter"), 400
    except Exception as e:
        return (
            create_response(
                False, None, f"Failed to retrieve paginated words: {str(e)}"
            ),
            500,
        )


@api_bp.route("/word/<int:word_id>", methods=["GET"])
def get_word(word_id):
    try:
        word = db_fetch_word_info(word_id)
        if word:
            return create_response(True, word, "Word retrieved successfully")
        else:
            return create_response(False, None, f"Word not found (id={word_id})"), 404
    except Exception as e:
        return create_response(False, None, f"Failed to retrieve word: {str(e)}"), 500


@api_bp.route("/word", methods=["POST"])
def insert_words():
    data = request.get_json()
    if not data or "word" not in data:
        return create_response(False, None, "缺少参数 word"), 400

    word = data["word"].strip().lower()
    source = data["source"]
    if not word or not source:
        return create_response(False, None, "单词不能为空"), 400

    new_word = db_insert_word(word, source)
    if not new_word:
        return create_response(False, None, f"单词 '{word}' 已存在或插入失败"), 400

    def background_task(word_id, word):
        update_word_definition(word_id, word)  # 你已有的函数

    t = threading.Thread(
        target=background_task, args=(new_word["id"], new_word["word"])
    )
    t.daemon = True
    t.start()

    return create_response(True, new_word, "Word inserted successfully")


@api_bp.route("/words/batch", methods=["POST"])
def batch_insert_words():
    """批量导入单词"""
    data = request.get_json()
    if not data or "words" not in data or "source" not in data:
        return create_response(False, None, "缺少参数 words 或 source"), 400

    words_list = data["words"]
    source = data["source"]

    if not isinstance(words_list, list) or not words_list:
        return create_response(False, None, "words 必须是非空数组"), 400

    if source not in ["IELTS", "GRE"]:
        return create_response(False, None, "source 必须是 IELTS 或 GRE"), 400

    success_count = 0
    failed_count = 0
    failed_words = []
    inserted_words = []

    for word_text in words_list:
        word_text = word_text.strip().lower()
        if not word_text:
            continue

        new_word = db_insert_word(word_text, source)
        if new_word:
            success_count += 1
            inserted_words.append(new_word)

            # 后台获取定义
            def background_task(word_id, word):
                update_word_definition(word_id, word)

            t = threading.Thread(
                target=background_task, args=(new_word["id"], new_word["word"])
            )
            t.daemon = True
            t.start()
        else:
            failed_count += 1
            failed_words.append(word_text)

    return create_response(
        True,
        {
            "success_count": success_count,
            "failed_count": failed_count,
            "failed_words": failed_words[:10],  # 只返回前10个失败的单词
            "total": len(words_list),
            "inserted_words": inserted_words,  # 返回插入的单词列表
        },
        f"批量导入完成：成功 {success_count}，失败 {failed_count}",
    )


@api_bp.route("/word/<int:word_id>", methods=["DELETE"])
def delete_word(word_id):
    try:
        if not db_delete_word(word_id):
            return create_response(False, None, f"未找到单词 (id={word_id})"), 404
        return create_response(True, None, f"单词已删除 (id={word_id})")
    except Exception as e:
        return create_response(False, None, f"Failed to delete word: {str(e)}"), 500


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
            update_data["definition"] = get_bold_definition(
                update_data["word"], update_data["definition"]
            )

        # 5. 调用数据库更新函数，并获取完整的更新后对象
        message, code, updated_word = db_update_word(word_id, update_data)

        if code == 200:
            # 如果设置了stop_review，也需要更新进度索引
            if update_data.get("stop_review"):
                # 从请求数据中获取mode
                mode = update_data.get("mode", MODE_REVIEW)
                if mode == MODE_LAPSE:
                    try:
                        update_lapse_progress_after_word_update(word_id, updated_word)
                        # lapse模式索引始终为0（循环队列）
                        update_current_progress_index(0)
                        print(f"Lapse mode: word {word_id} stopped, index=0")
                    except Exception as e:
                        print(f"Failed to update lapse progress snapshot: {e}")
                else:
                    # 其他模式：根据快照计算索引位置
                    try:
                        all_ids = session.get(SESSION_KEY_SNAPSHOT, [])
                        if word_id in all_ids:
                            current_index = (
                                all_ids.index(word_id) + 1
                            )  # +1 因为已完成当前单词
                            update_current_progress_index(current_index)
                    except Exception as e:
                        print(f"Failed to update progress index: {e}")

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
    try:
        # 获取参数
        mode = request.args.get("mode", "mode_review")
        batch_size = int(request.args.get("batch_size", 20))
        offset = int(request.args.get("offset", 0))
        batch_id = int(request.args.get("batch_id", 0))
        limit = request.args.get("limit", None)

        # 获取shuffle设置 - 先从请求参数获取，如果没有则从session获取
        shuffle_param = request.args.get("shuffle")
        if shuffle_param is not None:
            shuffle_enabled = shuffle_param.lower() == "true"
            # 更新session中的shuffle设置
            session["shuffle"] = shuffle_enabled
        else:
            shuffle_enabled = session.get("shuffle", False)

        # 第一次请求，batch_id=0 - 总是创建新的进度
        if batch_id == 0:
            all_ids = fetch_word_ids_by_mode(mode, limit)  # 获取所有单词ID

            # Apply shuffle logic
            all_ids = apply_shuffle_logic(all_ids, mode, shuffle_enabled)

            # 保存进度快照（新建）
            save_word_ids_snapshot(mode, all_ids, shuffle_enabled, limit)

            session[SESSION_KEY_SNAPSHOT] = all_ids  # 存到 session (保持兼容)
        else:
            # 从 session 获取快照
            all_ids = session.get(SESSION_KEY_SNAPSHOT, [])

        # 分页
        paginated_ids = all_ids[offset : offset + batch_size]

        # 批量获取单词数据 - 解决N+1查询问题
        words = db_get_words_review_info_batch(paginated_ids)

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

        if not is_spelling:
            # 根据模式更新
            if mode == MODE_REVIEW:
                update_word_info_review(word_id, remembered, elapsed_time)
            elif mode == MODE_LAPSE:
                update_word_info_lapse(word_id, remembered)
        else:
            if mode == MODE_SPELLING:
                update_word_info_spelling(word_id, remembered, spelling_data)

        updated_word = db_get_word_review_info(word_id)

        # lapse模式特殊处理：同步进度快照，索引始终为0
        if mode == MODE_LAPSE:
            try:
                update_lapse_progress_after_word_update(word_id, updated_word)
                # lapse模式索引始终为0（循环队列）
                update_current_progress_index(0)
                print(
                    f"Lapse mode: word {word_id} processed, lapse={updated_word.get('lapse', 0)}, index=0"
                )
            except Exception as e:
                print(f"Failed to update lapse progress snapshot: {e}")
        else:
            # 其他模式（包括拼写）：直接从数据库恢复快照，确保多设备同步
            try:
                from web_app.services.progress_service import try_restore_from_progress

                success, word_ids, progress_mode = try_restore_from_progress()

                if success and progress_mode == mode and word_ids:
                    all_ids = word_ids
                    if word_id in all_ids:
                        current_index = (
                            all_ids.index(word_id) + 1
                        )  # +1 因为已完成当前单词
                        update_current_progress_index(current_index)
            except Exception as e:
                print(f"Failed to update progress index: {e}")

        return create_response(
            True, updated_word, "Word review result updated successfully"
        )
    except Exception as e:
        return (
            create_response(False, None, f"Failed to update word result: {str(e)}"),
            500,
        )


@api_bp.route("/progress/restore", methods=["GET"])
def get_progress_restore():
    """获取可恢复的进度详情，用于前端恢复复习状态"""
    try:
        # 使用service层获取进度恢复数据
        success, progress_data = get_progress_restore_data()

        if not success:
            return create_response(False, None, "No progress to restore"), 404

        word_ids = progress_data.get("word_ids", [])
        if not word_ids:
            return create_response(False, None, "No words in progress snapshot"), 400

        # 批量获取单词数据
        words = db_get_words_review_info_batch(word_ids)

        return create_response(
            True,
            {"progress": progress_data, "words": words, "total": len(word_ids)},
            "Progress restore data retrieved successfully",
        )

    except Exception as e:
        return (
            create_response(False, None, f"Failed to get restore data: {str(e)}"),
            500,
        )
