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
        UserConfig.MAX_PREP_DAYS,  # 使用用户配置的最大准备天数
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
    from backend.config import UserConfig as Config

    word_info = db_fetch_word_info(word_id)
    if not word_info:
        return

    lapse = word_info.get("lapse", 0)

    if not remembered:
        # 答错：渐进增加，上限为配置值
        lapse = min(lapse + 1, Config.LAPSE_MAX_VALUE)
    else:
        # 答对：根据配置决定是否加速退出
        if Config.LAPSE_FAST_EXIT_ENABLED and lapse >= Config.LAPSE_CONSECUTIVE_THRESHOLD:
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
        max_prep_days=UserConfig.MAX_PREP_DAYS,  # 使用用户配置的最大准备天数
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
