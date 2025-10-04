# -*- coding: utf-8 -*-
import os

# 项目根目录（和 web_app 同级）
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 数据库路径
DB_PATH = os.path.join(BASE_DIR, "vocabulary.db")

STATIC_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")


# ========== 用户设置 ==========
class UserConfig:
    """用户自定义配置（持久化在此文件中）"""

    # 学习设置
    DAILY_REVIEW_LIMIT = 300  # 每日复习上限
    DAILY_SPELL_LIMIT = 200  # 每日拼写上限
    MAX_PREP_DAYS = 45  # 最大准备天数

    # 音频设置
    AUDIO_ACCENT = "uk"  # 音频口音：us (美音) 或 uk (英音)

    # 快捷键设置
    # 复习页面 - 初始状态
    HOTKEY_REVIEW_INITIAL_REMEMBERED = "ArrowUp"
    HOTKEY_REVIEW_INITIAL_NOT_REMEMBERED = "ArrowRight"
    HOTKEY_REVIEW_INITIAL_STOP_REVIEW = "ArrowDown"
    # 复习页面 - 显示释义后
    HOTKEY_REVIEW_AFTER_WRONG = "ArrowLeft"
    HOTKEY_REVIEW_AFTER_NEXT = "ArrowRight"
    # 拼写页面
    HOTKEY_SPELLING_PLAY_AUDIO = "ArrowLeft"
    HOTKEY_SPELLING_FORGOT = "ArrowRight"
    HOTKEY_SPELLING_NEXT = "Enter"

    @classmethod
    def to_dict(cls):
        """转换为字典用于API传输"""
        return {
            "learning": {
                "dailyReviewLimit": cls.DAILY_REVIEW_LIMIT,
                "dailySpellLimit": cls.DAILY_SPELL_LIMIT,
                "maxPrepDays": cls.MAX_PREP_DAYS,
            },
            "audio": {
                "accent": cls.AUDIO_ACCENT,
            },
            "hotkeys": {
                "reviewInitial": {
                    "remembered": cls.HOTKEY_REVIEW_INITIAL_REMEMBERED,
                    "notRemembered": cls.HOTKEY_REVIEW_INITIAL_NOT_REMEMBERED,
                    "stopReview": cls.HOTKEY_REVIEW_INITIAL_STOP_REVIEW,
                },
                "reviewAfter": {
                    "wrong": cls.HOTKEY_REVIEW_AFTER_WRONG,
                    "next": cls.HOTKEY_REVIEW_AFTER_NEXT,
                },
                "spelling": {
                    "playAudio": cls.HOTKEY_SPELLING_PLAY_AUDIO,
                    "forgot": cls.HOTKEY_SPELLING_FORGOT,
                    "next": cls.HOTKEY_SPELLING_NEXT,
                }
            }
        }

    @classmethod
    def update_from_dict(cls, data):
        """从字典更新配置"""
        learning = data.get("learning", {})
        if "dailyReviewLimit" in learning:
            cls.DAILY_REVIEW_LIMIT = learning["dailyReviewLimit"]
        if "dailySpellLimit" in learning:
            cls.DAILY_SPELL_LIMIT = learning["dailySpellLimit"]
        if "maxPrepDays" in learning:
            cls.MAX_PREP_DAYS = learning["maxPrepDays"]

        audio = data.get("audio", {})
        if "accent" in audio:
            cls.AUDIO_ACCENT = audio["accent"]

        hotkeys = data.get("hotkeys", {})
        review_initial = hotkeys.get("reviewInitial", {})
        if "remembered" in review_initial:
            cls.HOTKEY_REVIEW_INITIAL_REMEMBERED = review_initial["remembered"]
        if "notRemembered" in review_initial:
            cls.HOTKEY_REVIEW_INITIAL_NOT_REMEMBERED = review_initial["notRemembered"]
        if "stopReview" in review_initial:
            cls.HOTKEY_REVIEW_INITIAL_STOP_REVIEW = review_initial["stopReview"]

        review_after = hotkeys.get("reviewAfter", {})
        if "wrong" in review_after:
            cls.HOTKEY_REVIEW_AFTER_WRONG = review_after["wrong"]
        if "next" in review_after:
            cls.HOTKEY_REVIEW_AFTER_NEXT = review_after["next"]

        spelling = hotkeys.get("spelling", {})
        if "playAudio" in spelling:
            cls.HOTKEY_SPELLING_PLAY_AUDIO = spelling["playAudio"]
        if "forgot" in spelling:
            cls.HOTKEY_SPELLING_FORGOT = spelling["forgot"]
        if "next" in spelling:
            cls.HOTKEY_SPELLING_NEXT = spelling["next"]
