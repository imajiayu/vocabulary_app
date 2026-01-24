# -*- coding: utf-8 -*-
import datetime
from flask import session


from backend.config import UserConfig
from backend.core.review_repetition import (
    calculate_avg_elapsed_time,
    calculate_score,
    calculate_srs_parameters_with_load_balancing,
)
from backend.core.spell_repetition import (
    calculate_spell_strength_with_load_balancing,
)
from backend.database.vocabulary_dao import (
    db_fetch_word_info,
    db_update_word_for_lapse,
    db_update_word_for_review,
    db_update_word_for_spelling,
)


# ============================================================================
# 分离式 API：计算与持久化解耦，用于优化响应速度
# ============================================================================


def calculate_review_result(word_id, remembered, elapsed_time):
    """
    只计算复习结果，不写数据库。返回 notification 数据和需要持久化的参数。

    Returns:
        dict: {
            "notification": {...},  # 前端显示用
            "persist_data": {...},  # 后续持久化用
        }
        或 None（单词不存在）
    """
    word_info = db_fetch_word_info(word_id)
    if not word_info:
        return None

    interval = word_info.get("interval", 1)
    repetition = word_info.get("repetition", 0)
    old_ease_factor = word_info.get("ease_factor", 2.5)
    ease_factor = old_ease_factor
    lapse = word_info.get("lapse", 0)

    avg_elapsed_time = calculate_avg_elapsed_time(word_id, elapsed_time)
    score = calculate_score(remembered, elapsed_time)
    today = datetime.date.today()

    word_source = word_info.get("source")
    (
        repetition,
        interval,
        ease_factor,
        last_remembered,
        last_forgot,
        remember_inc,
        forget_inc,
        lapse,
    ) = calculate_srs_parameters_with_load_balancing(
        score,
        interval,
        repetition,
        ease_factor,
        lapse,
        word_source,
        today,
        UserConfig().MAX_PREP_DAYS,
    )

    next_review = today + datetime.timedelta(days=interval)
    should_stop_review = ease_factor >= 3.0 and repetition >= 6

    # 构建 notification
    ease_factor_change = round(ease_factor - old_ease_factor, 2)
    word_text = word_info.get("word", "")
    review_breakdown = {
        "elapsed_time": elapsed_time,
        "remembered": remembered,
        "score": score,
        "repetition": repetition,
        "interval": interval,
    }

    return {
        "notification": {
            "word": word_text,
            "param_type": "ease_factor",
            "param_change": ease_factor_change,
            "new_param_value": round(ease_factor, 2),
            "next_review_date": next_review.isoformat(),
            "breakdown": review_breakdown,
        },
        "persist_data": {
            "word_id": word_id,
            "last_remembered": last_remembered,
            "last_forgot": last_forgot,
            "remember_inc": remember_inc,
            "forget_inc": forget_inc,
            "repetition": repetition,
            "interval": interval,
            "ease_factor": round(ease_factor, 2),
            "score": score,
            "next_review": next_review.isoformat(),
            "lapse": lapse,
            "avg_elapsed_time": avg_elapsed_time,
            "should_stop_review": should_stop_review,
        },
    }


def persist_review_result(persist_data):
    """
    持久化复习结果到数据库。

    Args:
        persist_data: calculate_review_result 返回的 persist_data
    """
    next_review = datetime.date.fromisoformat(persist_data["next_review"])
    db_update_word_for_review(
        persist_data["word_id"],
        persist_data["last_remembered"],
        persist_data["last_forgot"],
        persist_data["remember_inc"],
        persist_data["forget_inc"],
        persist_data["repetition"],
        persist_data["interval"],
        persist_data["ease_factor"],
        persist_data["score"],
        next_review,
        persist_data["lapse"],
        persist_data["avg_elapsed_time"],
        persist_data["should_stop_review"],
    )


def calculate_spelling_result(word_id, remembered, spelling_data):
    """
    只计算拼写结果，不写数据库。返回 notification 数据和需要持久化的参数。

    Returns:
        dict: {
            "notification": {...},
            "persist_data": {...},
        }
        或 None（单词不存在）
    """
    word_info = db_fetch_word_info(word_id)
    if not word_info:
        return None

    word = word_info.get("word")
    word_source = word_info.get("source")
    if not word:
        return None

    current_strength = word_info.get("spell_strength") or 0
    today = datetime.date.today()

    strength_change, interval_days, breakdown_info = calculate_spell_strength_with_load_balancing(
        spelling_data,
        remembered,
        word,
        word_source,
        today,
        current_strength,
        max_prep_days=UserConfig().MAX_PREP_DAYS,
    )

    new_strength = max(0, min(5.0, (current_strength or 0) + strength_change))
    next_review = today + datetime.timedelta(days=interval_days)

    return {
        "notification": {
            "word": word,
            "param_type": "spell_strength",
            "param_change": round(strength_change, 2),
            "new_param_value": round(new_strength, 2),
            "next_review_date": next_review.isoformat(),
            "breakdown": breakdown_info,
        },
        "persist_data": {
            "word_id": word_id,
            "new_strength": round(new_strength, 2),
            "next_review": next_review.isoformat(),
        },
    }


def persist_spelling_result(persist_data):
    """
    持久化拼写结果到数据库。

    Args:
        persist_data: calculate_spelling_result 返回的 persist_data
    """
    next_review = datetime.date.fromisoformat(persist_data["next_review"])
    db_update_word_for_spelling(
        persist_data["word_id"],
        persist_data["new_strength"],
        next_review,
    )


# ============================================================================
# 原有的同步 API（保持向后兼容，lapse 模式仍使用）
# ============================================================================


def update_word_info_review(word_id, remembered, elapsed_time):
    """
    更新已有单词的复习信息（MODE_REVIEW）

    Returns:
        dict: 通知数据，包含复习参数变化信息，用于前端显示通知
    """
    word_info = db_fetch_word_info(word_id)
    if not word_info:
        return None  # 单词不存在

    interval = word_info.get("interval", 1)
    repetition = word_info.get("repetition", 0)
    old_ease_factor = word_info.get("ease_factor", 2.5)
    ease_factor = old_ease_factor
    lapse = word_info.get("lapse", 0)

    avg_elapsed_time = calculate_avg_elapsed_time(word_id, elapsed_time)

    # 2️⃣ 计算 score
    score = calculate_score(remembered, elapsed_time)

    # 3️⃣ 获取今天的日期作为基准日期
    today = datetime.date.today()

    # 4️⃣ 计算新的 SRS 参数（使用负荷均衡算法）
    word_source = word_info.get("source")
    (
        repetition,
        interval,
        ease_factor,
        last_remembered,
        last_forgot,
        remember_inc,
        forget_inc,
        lapse,
    ) = calculate_srs_parameters_with_load_balancing(
        score,
        interval,
        repetition,
        ease_factor,
        lapse,
        word_source,
        today,  # 使用今天的日期作为基准
        UserConfig().MAX_PREP_DAYS,  # 使用用户配置的最大准备天数
    )

    # 5️⃣ 计算下次复习日期（从今天开始计算）
    next_review = today + datetime.timedelta(days=interval)

    # 5.5️⃣ 检查是否需要设置 stop_review = 1（已完全掌握）
    should_stop_review = ease_factor >= 3.0 and repetition >= 6

    # 6️⃣ 更新数据库
    db_update_word_for_review(
        word_id,
        last_remembered,
        last_forgot,
        remember_inc,
        forget_inc,
        repetition,
        interval,
        round(ease_factor, 2),
        score,
        next_review,
        lapse,
        avg_elapsed_time,
        should_stop_review,
    )

    # 7️⃣ 构建并返回通知数据（带回忆时间信息）
    ease_factor_change = round(ease_factor - old_ease_factor, 2)
    word_text = word_info.get("word", "")

    # 构建复习模式的 breakdown 信息
    review_breakdown = {
        "elapsed_time": elapsed_time,
        "remembered": remembered,
        "score": score,
        "repetition": repetition,
        "interval": interval,
    }

    return {
        "word": word_text,
        "param_type": "ease_factor",
        "param_change": ease_factor_change,
        "new_param_value": round(ease_factor, 2),
        "next_review_date": next_review.isoformat(),
        "breakdown": review_breakdown,
    }


def update_word_info_lapse(word_id, remembered):
    """
    更新错题集单词信息（MODE_LAPSE）
    仅更新 SRS 核心参数和 lapse，不修改长期统计字段

    优化策略：
    - 答错：lapse+1，最大为LAPSE_MAX_VALUE（默认4）
    - 答对：lapse-1（基础）
    - 答对且启用加速退出：lapse≥阈值时（默认≥2），lapse-2（加速）
    """
    from backend.config import UserConfig

    word_info = db_fetch_word_info(word_id)
    if not word_info:
        return

    lapse = word_info.get("lapse", 0)
    config = UserConfig()  # 创建实例以访问属性

    if not remembered:
        # 答错：渐进增加，上限为配置值
        lapse = min(lapse + 1, config.LAPSE_MAX_VALUE)
    else:
        # 答对：根据配置决定是否加速退出
        if config.LAPSE_FAST_EXIT_ENABLED and lapse >= config.LAPSE_CONSECUTIVE_THRESHOLD:
            # 加速退出：当lapse≥阈值（默认2）时，答对一次就-2
            lapse = max(0, lapse - 2)
        else:
            # 正常退出：lapse<阈值时，答对一次-1
            lapse = max(0, lapse - 1)

    db_update_word_for_lapse(word_id, lapse)


def update_word_info_spelling(word_id, remembered, spelling_data):
    """
    更新单词拼写信息（MODE_SPELLING）

    Returns:
        dict: 通知数据，包含拼写强度变化信息，用于前端显示通知
    """
    word_info = db_fetch_word_info(word_id)
    if not word_info:
        return None

    word = word_info.get("word")
    word_source = word_info.get("source")
    if not word:
        return None

    current_strength = word_info.get("spell_strength") or 0

    # 使用今天的日期作为基准日期
    today = datetime.date.today()

    # 使用负荷均衡的拼写算法（从今天开始计算）
    strength_change, interval_days, breakdown_info = calculate_spell_strength_with_load_balancing(
        spelling_data,
        remembered,
        word,
        word_source,
        today,
        current_strength,
        max_prep_days=UserConfig().MAX_PREP_DAYS,  # 使用用户配置的最大准备天数
    )

    # 计算新的强度 (ensure current_strength is not None, and cap at 5.0)
    new_strength = max(0, min(5.0, (current_strength or 0) + strength_change))

    # 计算下次拼写复习时间（从今天开始计算）
    next_review = today + datetime.timedelta(days=interval_days)

    db_update_word_for_spelling(word_id, round(new_strength, 2), next_review)

    # 返回通知数据（带详细评分信息）
    return {
        "word": word,
        "param_type": "spell_strength",
        "param_change": round(strength_change, 2),
        "new_param_value": round(new_strength, 2),
        "next_review_date": next_review.isoformat(),
        "breakdown": breakdown_info,  # 传递详细评分信息
    }
