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
            content = re.sub(
                r"MAX_PREP_DAYS\s*=\s*\d+",
                f"MAX_PREP_DAYS = {learning['maxPrepDays']}",
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
