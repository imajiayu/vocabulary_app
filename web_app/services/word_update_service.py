# -*- coding: utf-8 -*-
import datetime
from flask import session


from web_app.core.spaced_repetition import (
    calculate_avg_elapsed_time,
    calculate_score,
    calculate_srs_parameters_with_load_balancing,
    calculate_spell_strength_with_load_balancing,
)
from web_app.database.vocabulary_dao import (
    db_fetch_word_info,
    db_update_word_for_lapse,
    db_update_word_for_review,
    db_update_word_for_spelling,
)


def update_word_info_review(word_id, remembered, elapsed_time):
    """
    更新已有单词的复习信息（MODE_REVIEW）
    """
    word_info = db_fetch_word_info(word_id)
    if not word_info:
        return  # 单词不存在

    interval = word_info.get("interval", 1)
    repetition = word_info.get("repetition", 0)
    ease_factor = word_info.get("ease_factor", 2.5)
    lapse = word_info.get("lapse", 0)

    # word_info['next_review'] is a string from to_dict().isoformat()
    next_review_str = word_info.get("next_review")
    if not next_review_str:
        return
    original_next_review = datetime.datetime.strptime(
        next_review_str, "%Y-%m-%d"
    ).date()

    avg_elapsed_time = calculate_avg_elapsed_time(word_id, elapsed_time)

    # 2️⃣ 计算 score
    score = calculate_score(remembered, elapsed_time)

    # 3️⃣ 计算新的 SRS 参数（使用负荷均衡算法）
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
        score, interval, repetition, ease_factor, lapse, word_source
    )

    # 4️⃣ 计算下次复习日期
    next_review = original_next_review + datetime.timedelta(days=interval)

    # 5️⃣ 更新数据库
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
    )


def update_word_info_lapse(word_id, remembered):
    """
    更新错题集单词信息（MODE_LAPSE）
    仅更新 SRS 核心参数和 lapse，不修改长期统计字段
    """
    word_info = db_fetch_word_info(word_id)
    if not word_info:
        return

    lapse = word_info.get("lapse", 0)

    if not remembered:
        lapse = min(lapse + 1, 10)
    else:
        lapse = max(0, lapse - 1)

    db_update_word_for_lapse(word_id, lapse)


def update_word_info_spelling(word_id, remembered, spelling_data):
    word_info = db_fetch_word_info(word_id)
    if not word_info:
        return

    word = word_info.get("word")
    word_source = word_info.get("source")
    if not word:
        return

    current_strength = word_info.get("spell_strength") or 0
    # word_info['spell_next_review'] is a string from to_dict().isoformat()
    spell_next_review_str = word_info.get("spell_next_review")
    current_next_review = (
        datetime.datetime.strptime(spell_next_review_str, "%Y-%m-%d").date()
        if spell_next_review_str
        else None
    )

    # 使用负荷均衡的拼写算法
    strength_change, interval_days = calculate_spell_strength_with_load_balancing(
        spelling_data, remembered, word, word_source, current_strength
    )

    # 计算新的强度 (ensure current_strength is not None, and cap at 5.0)
    new_strength = max(0, min(5.0, (current_strength or 0) + strength_change))

    # 计算下次拼写复习时间
    base_date = current_next_review if current_next_review else datetime.date.today()
    next_review = base_date + datetime.timedelta(days=interval_days)

    db_update_word_for_spelling(word_id, round(new_strength, 2), next_review)
