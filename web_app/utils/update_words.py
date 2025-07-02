# -*- coding: utf-8 -*-
import datetime
from flask import session
from web_app.utils.algorithms import calculate_avg_elapsed_time, calculate_score, calculate_srs_parameters
from web_app.utils.db_tools import get_db


def update_word_info_new(word_id, remembered, elapsed_time):
    cursor = get_db().cursor()
    today = datetime.datetime.now().date()
    next_review = today + datetime.timedelta(days=1)

    # 计算新的平均停留时间（可以保留，统计用途）
    avg_elapsed = calculate_avg_elapsed_time(word_id, elapsed_time)

    if remembered:
        cursor.execute(
            """
            UPDATE IELTS
            SET last_remembered = ?,
                remember_count = remember_count + 1,
                avg_elapsed_time = ?,
                next_review = ?
            WHERE id = ?
            """,
            (today, avg_elapsed, next_review, word_id)
        )
    else:
        cursor.execute(
            """
            UPDATE IELTS
            SET last_forgot = ?,
                forget_count = forget_count + 1,
                avg_elapsed_time = ?,
                next_review = ?
            WHERE id = ?
            """,
            (today, avg_elapsed, next_review, word_id)
        )
    cursor.connection.commit()



def update_word_info_review(word_id, remembered, elapsed_time):
    """
    更新已有单词的复习信息（MODE_REVIEW）
    """
    cursor = get_db().cursor()
    # 1️⃣ 获取当前单词信息
    cursor.execute(
        "SELECT interval, repetition, ease_factor FROM IELTS WHERE id = ?",
        (word_id,)
    )
    row = cursor.fetchone()
    if not row:
        return  # 单词不存在
    interval, repetition, ease_factor = row

    avg_elapsed_time = calculate_avg_elapsed_time(word_id, elapsed_time)

    # 2️⃣ 计算 score
    score = calculate_score(remembered, elapsed_time)

    # 3️⃣ 计算新的 SRS 参数
    repetition, interval, ease_factor, last_remembered, last_forgot, remember_inc, forget_inc, lapse = \
        calculate_srs_parameters(score, interval, repetition, ease_factor)

    # 4️⃣ 计算下次复习日期
    next_review = datetime.date.today() + datetime.timedelta(days=interval)

    # 5️⃣ 更新数据库
    cursor.execute(
        """
        UPDATE IELTS
        SET last_remembered = COALESCE(?, last_remembered),
            last_forgot = COALESCE(?, last_forgot),
            remember_count = remember_count + ?,
            forget_count = forget_count + ?,
            repetition = ?,
            interval = ?,
            ease_factor = ?,
            last_score = ?,
            next_review = ?,
            lapse = ?,
            avg_elapsed_time = ?
        WHERE id = ?
        """,
        (
            last_remembered, last_forgot,
            remember_inc, forget_inc,
            repetition, interval, ease_factor,
            score, next_review, lapse, avg_elapsed_time, word_id
        )
    )
    cursor.connection.commit()

def update_word_info_lapse(word_id, remembered):
    """
    更新错题集单词信息（MODE_LAPSE）
    仅更新 SRS 核心参数和 lapse，不修改长期统计字段
    """
    cursor = get_db().cursor()

    # 1️⃣ 获取当前单词信息
    cursor.execute(
        "SELECT lapse, ease_factor FROM IELTS WHERE id = ?",
        (word_id,)
    )
    row = cursor.fetchone()
    if not row:
        return
    lapse, ease_factor = row

    if not remembered:
        lapse = (lapse if lapse >= 0 else 0) + 1
        
        if lapse > 3:
            ease_factor = max(1.3, ease_factor * 0.98**(lapse - 3))
    else:
        lapse = max(0, lapse - 1)

        if lapse > 3:
            ease_factor = min(3.0, ease_factor * 1.01)
            

    if lapse == 0:
        word_id_list = session.get("word_id_list", [])
        word_id_list.remove(word_id)
        session["word_id_list"] = word_id_list

    cursor.execute(
        """
        UPDATE IELTS
        SET ease_factor = ?,
            lapse = ?
        WHERE id = ?
        """,
        (ease_factor, lapse, word_id)
    )
    cursor.connection.commit()