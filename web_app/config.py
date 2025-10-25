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

    # Lapse模式设置（错题集）
    # 基于认知心理学优化：目标是确保单词间隔在5-10分钟（最佳记忆间隔）
    # 假设每个单词15秒，则：15个=3.75分钟，25个=6.25分钟，35个=8.75分钟
    LAPSE_QUEUE_SIZE = 25  # 错题集队列长度（默认25，推荐范围20-30）
    LAPSE_MAX_VALUE = 4  # lapse最大值（从5降到4，避免"永久错题"）
    LAPSE_INITIAL_VALUE = 3  # 首次进入错题集的lapse值
    LAPSE_FAST_EXIT_ENABLED = True  # 是否启用加速退出（当lapse≥阈值时，答对-2而非-1）
    LAPSE_CONSECUTIVE_THRESHOLD = 4  # 触发加速退出的lapse阈值（lapse≥此值时启用加速）

    # 单词管理设置
    WORDS_LOAD_BATCH_SIZE = 200  # 单词管理页面每批加载的单词数量
    DEFINITION_FETCH_THREADS = 3  # 填充释义的并发线程数（推荐2-5）

    # 复习顺序设置
    DEFAULT_SHUFFLE = True  # 默认是否打乱顺序

    # 低EF单词优先设置
    LOW_EF_EXTRA_COUNT = 0  # 复习模式额外拉取的低EF单词数量（提升低EF单词的复习频率）

    # 音频设置
    AUDIO_ACCENT = "us"  # 音频口音：us (美音) 或 uk (英音)
    AUDIO_AUTO_PLAY_ON_WORD_CHANGE = True  # 新单词出现时自动播放
    AUDIO_AUTO_PLAY_AFTER_ANSWER = True  # 选择答案后自动播放

    # 快捷键设置
    # 复习页面 - 初始状态
    HOTKEY_REVIEW_INITIAL_REMEMBERED = "ArrowLeft"
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
                "lapseQueueSize": cls.LAPSE_QUEUE_SIZE,
                "lapseMaxValue": cls.LAPSE_MAX_VALUE,
                "lapseInitialValue": cls.LAPSE_INITIAL_VALUE,
                "lapseFastExitEnabled": cls.LAPSE_FAST_EXIT_ENABLED,
                "lapseConsecutiveThreshold": cls.LAPSE_CONSECUTIVE_THRESHOLD,
                "defaultShuffle": cls.DEFAULT_SHUFFLE,
                "lowEfExtraCount": cls.LOW_EF_EXTRA_COUNT,
            },
            "management": {
                "wordsLoadBatchSize": cls.WORDS_LOAD_BATCH_SIZE,
                "definitionFetchThreads": cls.DEFINITION_FETCH_THREADS,
            },
            "audio": {
                "accent": cls.AUDIO_ACCENT,
                "autoPlayOnWordChange": cls.AUDIO_AUTO_PLAY_ON_WORD_CHANGE,
                "autoPlayAfterAnswer": cls.AUDIO_AUTO_PLAY_AFTER_ANSWER,
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
                },
            },
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
        if "lapseQueueSize" in learning:
            cls.LAPSE_QUEUE_SIZE = learning["lapseQueueSize"]
        if "lapseMaxValue" in learning:
            cls.LAPSE_MAX_VALUE = learning["lapseMaxValue"]
        if "lapseInitialValue" in learning:
            cls.LAPSE_INITIAL_VALUE = learning["lapseInitialValue"]
        if "lapseFastExitEnabled" in learning:
            cls.LAPSE_FAST_EXIT_ENABLED = learning["lapseFastExitEnabled"]
        if "lapseConsecutiveThreshold" in learning:
            cls.LAPSE_CONSECUTIVE_THRESHOLD = learning["lapseConsecutiveThreshold"]
        if "defaultShuffle" in learning:
            cls.DEFAULT_SHUFFLE = learning["defaultShuffle"]
        if "lowEfExtraCount" in learning:
            cls.LOW_EF_EXTRA_COUNT = learning["lowEfExtraCount"]

        management = data.get("management", {})
        if "wordsLoadBatchSize" in management:
            cls.WORDS_LOAD_BATCH_SIZE = management["wordsLoadBatchSize"]
        if "definitionFetchThreads" in management:
            cls.DEFINITION_FETCH_THREADS = management["definitionFetchThreads"]

        audio = data.get("audio", {})
        if "accent" in audio:
            cls.AUDIO_ACCENT = audio["accent"]
        if "autoPlayOnWordChange" in audio:
            cls.AUDIO_AUTO_PLAY_ON_WORD_CHANGE = audio["autoPlayOnWordChange"]
        if "autoPlayAfterAnswer" in audio:
            cls.AUDIO_AUTO_PLAY_AFTER_ANSWER = audio["autoPlayAfterAnswer"]

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


# --- 常量定义 ---
LOW_EF_THRESHOLD = 2.5  # 低 EF 阈值，用于判断需要加速复习的单词


# === 负荷均衡优化算法 ===
class ReviewLoadLimits:
    """每日复习负荷限制配置 - 从config读取用户设置"""

    @staticmethod
    def get_daily_review_limit():
        """获取每日复习限制"""
        return UserConfig.DAILY_REVIEW_LIMIT

    @staticmethod
    def get_daily_spell_limit():
        """获取每日拼写限制"""
        return UserConfig.DAILY_SPELL_LIMIT

    @staticmethod
    def get_max_prep_days():
        """获取最大备考天数"""
        return UserConfig.MAX_PREP_DAYS
