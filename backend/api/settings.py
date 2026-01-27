# -*- coding: utf-8 -*-
"""
用户设置API
提供设置的读取和更新接口
配置持久化在 user_config.json 中
"""
import logging
from flask import Blueprint, jsonify, request, session, g

from backend.config import UserConfig
from backend.extensions import get_session
from backend.models.word import Word, Progress

logger = logging.getLogger(__name__)
settings_bp = Blueprint("settings", __name__)


@settings_bp.route("/settings", methods=["GET"])
def get_settings():
    """
    获取用户设置
    返回: 完整的配置字典
    """
    user_id = g.user_id
    return jsonify(UserConfig.to_dict(user_id)), 200


@settings_bp.route("/settings", methods=["POST"])
def update_settings():
    """
    更新用户设置并持久化到数据库
    请求体: 任意配置字段的嵌套字典
    返回: 更新后的完整设置
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "请求体为空"}), 400

        user_id = g.user_id
        config = UserConfig(user_id)
        old_max_prep_days = config.MAX_PREP_DAYS

        # 更新配置
        UserConfig.update_from_dict(data, user_id)

        # 处理 maxPrepDays 变小的情况
        learning = data.get("learning", {})
        if "maxPrepDays" in learning:
            new_max_prep_days = learning["maxPrepDays"]
            if new_max_prep_days < old_max_prep_days:
                from backend.database.vocabulary_dao import adjust_words_for_max_prep_days
                adjust_words_for_max_prep_days(new_max_prep_days, user_id)

        # 保存到数据库
        config.save(user_id)

        return jsonify(UserConfig.to_dict(user_id)), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.exception("更新设置失败")
        return jsonify({"error": f"更新失败: {str(e)}"}), 500


@settings_bp.route("/settings/sources/<source_name>", methods=["DELETE"])
def delete_source(source_name):
    """
    删除指定的 source 及其所有关联数据
    """
    try:
        user_id = g.user_id
        config = UserConfig(user_id)
        current_sources = config.CUSTOM_SOURCES.copy()

        # 验证
        if len(current_sources) <= 1:
            return jsonify({"error": "至少需要保留1个source"}), 400

        if source_name not in current_sources:
            return jsonify({"error": f"source '{source_name}' 不存在"}), 404

        # 删除数据库中的相关数据（按用户过滤）
        with get_session() as db:
            deleted_words = db.query(Word).filter(
                Word.user_id == g.user_id, Word.source == source_name
            ).delete()
            deleted_progress = db.query(Progress).filter(
                Progress.user_id == g.user_id, Progress.source == source_name
            ).delete()
            db.commit()

        # 更新配置
        current_sources.remove(source_name)
        UserConfig.update_custom_sources(current_sources, user_id)
        config.save(user_id)

        # 切换当前 source
        if session.get("current_source") == source_name:
            session["current_source"] = current_sources[0]

        return jsonify({
            "message": f"成功删除 source '{source_name}'",
            "deleted_words": deleted_words,
            "deleted_progress": deleted_progress,
            "remaining_sources": current_sources,
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.exception(f"删除source失败: {source_name}")
        return jsonify({"error": f"删除失败: {str(e)}"}), 500


@settings_bp.route("/settings/sources/stats", methods=["GET"])
def get_sources_stats():
    """
    获取所有 sources 的统计信息（每个 source 的单词数量）
    """
    from sqlalchemy import func

    try:
        user_id = g.user_id
        config = UserConfig(user_id)

        with get_session() as db:
            source_counts = (
                db.query(Word.source, func.count(Word.id))
                .filter(Word.user_id == g.user_id)
                .group_by(Word.source)
                .all()
            )

            stats = {}
            for source in config.CUSTOM_SOURCES:
                count = next((c for s, c in source_counts if s == source), 0)
                stats[source] = count

            return jsonify(stats), 200

    except Exception as e:
        logger.exception("获取source统计失败")
        return jsonify({"error": f"获取统计信息失败: {str(e)}"}), 500
