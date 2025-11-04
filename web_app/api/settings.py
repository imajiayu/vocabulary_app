# -*- coding: utf-8 -*-
"""
用户设置API
提供设置的读取和更新接口
"""
from flask import Blueprint, jsonify, request
import os
import re

settings_bp = Blueprint("settings", __name__)


@settings_bp.route("/settings", methods=["GET"])
def get_settings():
    """
    获取用户设置
    返回: {learning: {dailyReviewLimit, dailySpellLimit, maxPrepDays}}
    """
    from web_app.config import UserConfig

    return jsonify(UserConfig.to_dict()), 200


@settings_bp.route("/settings", methods=["POST"])
def update_settings():
    """
    更新用户设置并持久化到config.py文件
    请求体: {learning: {dailyReviewLimit?, dailySpellLimit?, maxPrepDays?}}
    返回: 更新后的完整设置
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "请求体为空"}), 400

        # 获取config.py文件路径
        config_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "..", "config.py"
        )

        # 读取config.py内容
        with open(config_path, "r", encoding="utf-8") as f:
            content = f.read()

        # 更新配置值
        learning = data.get("learning", {})
        if "dailyReviewLimit" in learning:
            content = re.sub(
                r"DAILY_REVIEW_LIMIT\s*=\s*\d+",
                f"DAILY_REVIEW_LIMIT = {learning['dailyReviewLimit']}",
                content,
            )
        if "dailySpellLimit" in learning:
            content = re.sub(
                r"DAILY_SPELL_LIMIT\s*=\s*\d+",
                f"DAILY_SPELL_LIMIT = {learning['dailySpellLimit']}",
                content,
            )
        if "maxPrepDays" in learning:
            old_max_prep_days = None
            # 提取旧的 MAX_PREP_DAYS 值
            import re as re_module
            match = re_module.search(r"MAX_PREP_DAYS\s*=\s*(\d+)", content)
            if match:
                old_max_prep_days = int(match.group(1))

            new_max_prep_days = learning['maxPrepDays']
            content = re.sub(
                r"MAX_PREP_DAYS\s*=\s*\d+",
                f"MAX_PREP_DAYS = {new_max_prep_days}",
                content,
            )

            # 如果 maxPrepDays 变小了，需要调整超出范围的单词
            if old_max_prep_days and new_max_prep_days < old_max_prep_days:
                from web_app.database.vocabulary_dao import adjust_words_for_max_prep_days
                adjust_words_for_max_prep_days(new_max_prep_days)
        if "lapseQueueSize" in learning:
            content = re.sub(
                r"LAPSE_QUEUE_SIZE\s*=\s*\d+",
                f"LAPSE_QUEUE_SIZE = {learning['lapseQueueSize']}",
                content,
            )
        if "lapseMaxValue" in learning:
            content = re.sub(
                r"LAPSE_MAX_VALUE\s*=\s*\d+",
                f"LAPSE_MAX_VALUE = {learning['lapseMaxValue']}",
                content,
            )
        if "lapseInitialValue" in learning:
            content = re.sub(
                r"LAPSE_INITIAL_VALUE\s*=\s*\d+",
                f"LAPSE_INITIAL_VALUE = {learning['lapseInitialValue']}",
                content,
            )
        if "lapseFastExitEnabled" in learning:
            content = re.sub(
                r"LAPSE_FAST_EXIT_ENABLED\s*=\s*(?:True|False)",
                f"LAPSE_FAST_EXIT_ENABLED = {learning['lapseFastExitEnabled']}",
                content,
            )
        if "lapseConsecutiveThreshold" in learning:
            content = re.sub(
                r"LAPSE_CONSECUTIVE_THRESHOLD\s*=\s*\d+",
                f"LAPSE_CONSECUTIVE_THRESHOLD = {learning['lapseConsecutiveThreshold']}",
                content,
            )
        if "defaultShuffle" in learning:
            content = re.sub(
                r"DEFAULT_SHUFFLE\s*=\s*(?:True|False)",
                f"DEFAULT_SHUFFLE = {learning['defaultShuffle']}",
                content,
            )
        if "lowEfExtraCount" in learning:
            content = re.sub(
                r"LOW_EF_EXTRA_COUNT\s*=\s*\d+",
                f"LOW_EF_EXTRA_COUNT = {learning['lowEfExtraCount']}",
                content,
            )

        # 更新单词管理设置
        management = data.get("management", {})
        if "wordsLoadBatchSize" in management:
            content = re.sub(
                r"WORDS_LOAD_BATCH_SIZE\s*=\s*\d+",
                f"WORDS_LOAD_BATCH_SIZE = {management['wordsLoadBatchSize']}",
                content,
            )
        if "definitionFetchThreads" in management:
            content = re.sub(
                r"DEFINITION_FETCH_THREADS\s*=\s*\d+",
                f"DEFINITION_FETCH_THREADS = {management['definitionFetchThreads']}",
                content,
            )

        # 更新音频设置
        audio = data.get("audio", {})
        if "accent" in audio:
            content = re.sub(
                r'AUDIO_ACCENT\s*=\s*["\'](?:us|uk)["\']',
                f'AUDIO_ACCENT = "{audio["accent"]}"',
                content,
            )
        if "autoPlayOnWordChange" in audio:
            content = re.sub(
                r'AUDIO_AUTO_PLAY_ON_WORD_CHANGE\s*=\s*(?:True|False)',
                f'AUDIO_AUTO_PLAY_ON_WORD_CHANGE = {audio["autoPlayOnWordChange"]}',
                content,
            )
        if "autoPlayAfterAnswer" in audio:
            content = re.sub(
                r'AUDIO_AUTO_PLAY_AFTER_ANSWER\s*=\s*(?:True|False)',
                f'AUDIO_AUTO_PLAY_AFTER_ANSWER = {audio["autoPlayAfterAnswer"]}',
                content,
            )

        # 更新快捷键设置
        hotkeys = data.get("hotkeys", {})
        review_initial = hotkeys.get("reviewInitial", {})
        if "remembered" in review_initial:
            content = re.sub(
                r'HOTKEY_REVIEW_INITIAL_REMEMBERED\s*=\s*["\'][^"\']*["\']',
                f'HOTKEY_REVIEW_INITIAL_REMEMBERED = "{review_initial["remembered"]}"',
                content,
            )
        if "notRemembered" in review_initial:
            content = re.sub(
                r'HOTKEY_REVIEW_INITIAL_NOT_REMEMBERED\s*=\s*["\'][^"\']*["\']',
                f'HOTKEY_REVIEW_INITIAL_NOT_REMEMBERED = "{review_initial["notRemembered"]}"',
                content,
            )
        if "stopReview" in review_initial:
            content = re.sub(
                r'HOTKEY_REVIEW_INITIAL_STOP_REVIEW\s*=\s*["\'][^"\']*["\']',
                f'HOTKEY_REVIEW_INITIAL_STOP_REVIEW = "{review_initial["stopReview"]}"',
                content,
            )

        review_after = hotkeys.get("reviewAfter", {})
        if "wrong" in review_after:
            content = re.sub(
                r'HOTKEY_REVIEW_AFTER_WRONG\s*=\s*["\'][^"\']*["\']',
                f'HOTKEY_REVIEW_AFTER_WRONG = "{review_after["wrong"]}"',
                content,
            )
        if "next" in review_after:
            content = re.sub(
                r'HOTKEY_REVIEW_AFTER_NEXT\s*=\s*["\'][^"\']*["\']',
                f'HOTKEY_REVIEW_AFTER_NEXT = "{review_after["next"]}"',
                content,
            )

        spelling = hotkeys.get("spelling", {})
        if "playAudio" in spelling:
            content = re.sub(
                r'HOTKEY_SPELLING_PLAY_AUDIO\s*=\s*["\'][^"\']*["\']',
                f'HOTKEY_SPELLING_PLAY_AUDIO = "{spelling["playAudio"]}"',
                content,
            )
        if "forgot" in spelling:
            content = re.sub(
                r'HOTKEY_SPELLING_FORGOT\s*=\s*["\'][^"\']*["\']',
                f'HOTKEY_SPELLING_FORGOT = "{spelling["forgot"]}"',
                content,
            )
        if "next" in spelling:
            content = re.sub(
                r'HOTKEY_SPELLING_NEXT\s*=\s*["\'][^"\']*["\']',
                f'HOTKEY_SPELLING_NEXT = "{spelling["next"]}"',
                content,
            )

        # 更新 sources 设置
        sources = data.get("sources", {})
        if "customSources" in sources:
            import json as json_module

            custom_sources = sources["customSources"]
            # 验证：必须是列表，最少1个，最多3个，名称不能重复
            if isinstance(custom_sources, list) and 1 <= len(custom_sources) <= 3:
                if len(custom_sources) == len(set(custom_sources)):  # 去重检查
                    sources_str = json_module.dumps(custom_sources, ensure_ascii=False)
                    content = re.sub(
                        r"CUSTOM_SOURCES\s*=\s*\[[^\]]*\]",
                        f"CUSTOM_SOURCES = {sources_str}",
                        content,
                    )

        # 写回config.py
        with open(config_path, "w", encoding="utf-8") as f:
            f.write(content)

        # 重新加载config模块（更新内存中的值）
        import importlib
        import web_app.config

        importlib.reload(web_app.config)
        from web_app.config import UserConfig

        return jsonify(UserConfig.to_dict()), 200

    except Exception as e:
        return jsonify({"error": f"更新失败: {str(e)}"}), 400


@settings_bp.route("/settings/restart", methods=["POST"])
def restart_server():
    """
    重启服务器
    用于应用某些需要重启才能生效的配置更改（如 DEFINITION_FETCH_THREADS）
    """
    import os
    import subprocess
    import threading

    def restart():
        # 获取项目根目录（web_app/api -> web_app -> project_root）
        project_root = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )
        start_script = os.path.join(project_root, "start.sh")

        # 调用 ./start.sh restart backend 来重启后端
        subprocess.Popen([start_script, "restart", "backend"], cwd=project_root)

    # 在后台线程中执行restart，避免阻塞响应
    thread = threading.Thread(target=restart)
    thread.daemon = True
    thread.start()

    return jsonify({"message": "服务器正在重启..."}), 200


@settings_bp.route("/settings/sources/<source_name>", methods=["DELETE"])
def delete_source(source_name):
    """
    删除指定的 source 及其所有关联数据
    同时从 config.py 中移除该 source
    """
    from web_app.config import UserConfig
    from web_app.extensions import get_session
    from web_app.models.word import Word, Progress
    from flask import session

    try:
        # 1. 验证：不能删除到只剩0个source
        current_sources = UserConfig.CUSTOM_SOURCES.copy()
        if len(current_sources) <= 1:
            return jsonify({"error": "至少需要保留1个source"}), 400

        if source_name not in current_sources:
            return jsonify({"error": f"source '{source_name}' 不存在"}), 404

        # 2. 删除数据库中的所有相关数据
        with get_session() as db:
            # 删除所有该 source 的单词
            deleted_words = db.query(Word).filter(Word.source == source_name).delete()

            # 删除所有该 source 的进度记录
            deleted_progress = (
                db.query(Progress).filter(Progress.source == source_name).delete()
            )

            db.commit()

            # 3. 从 config.py 中移除该 source
            current_sources.remove(source_name)

            # 读取 config.py
            config_path = os.path.join(
                os.path.dirname(os.path.abspath(__file__)), "..", "config.py"
            )
            with open(config_path, "r", encoding="utf-8") as f:
                content = f.read()

            # 更新 CUSTOM_SOURCES
            import json as json_module

            sources_str = json_module.dumps(current_sources, ensure_ascii=False)
            content = re.sub(
                r"CUSTOM_SOURCES\s*=\s*\[[^\]]*\]",
                f"CUSTOM_SOURCES = {sources_str}",
                content,
            )

            # 写回 config.py
            with open(config_path, "w", encoding="utf-8") as f:
                f.write(content)

            # 4. 重新加载 config 模块
            import importlib
            import web_app.config

            importlib.reload(web_app.config)

        # 5. 如果删除的是当前选中的 source，切换到第一个可用的 source
        if session.get("current_source") == source_name:
            session["current_source"] = current_sources[0]

        return (
            jsonify(
                {
                    "message": f"成功删除 source '{source_name}'",
                    "deleted_words": deleted_words,
                    "deleted_progress": deleted_progress,
                    "remaining_sources": current_sources,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": f"删除失败: {str(e)}"}), 400


@settings_bp.route("/settings/sources/stats", methods=["GET"])
def get_sources_stats():
    """
    获取所有 sources 的统计信息（每个 source 的单词数量）
    """
    from web_app.config import UserConfig
    from web_app.extensions import get_session
    from web_app.models.word import Word
    from sqlalchemy import func

    try:
        with get_session() as db:
            # 获取每个 source 的单词数量
            source_counts = (
                db.query(Word.source, func.count(Word.id))
                .group_by(Word.source)
                .all()
            )

            # 构建结果字典
            stats = {}
            for source in UserConfig.CUSTOM_SOURCES:
                count = next((c for s, c in source_counts if s == source), 0)
                stats[source] = count

            return jsonify(stats), 200

    except Exception as e:
        return jsonify({"error": f"获取统计信息失败: {str(e)}"}), 400
