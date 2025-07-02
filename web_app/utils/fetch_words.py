# -*- coding: utf-8 -*-
import datetime, random, sqlite3
from flask import session
from web_app.const import MODE_NEW, MODE_REVIEW, MODE_LAPSE, MODE_SPELLING
from web_app.utils.db_tools import get_db

def fetch_word_ids(mode = MODE_REVIEW, shuffle = True):
    if mode == MODE_NEW:
        word_ids = fetch_new_word_ids(shuffle)
    elif mode == MODE_REVIEW:
        word_ids = fetch_review_word_ids(shuffle)
    elif mode == MODE_LAPSE:
        word_ids = fetch_lapse_word_ids(shuffle)
    elif mode == MODE_SPELLING:
        word_ids = fetch_spelling_candidates()
    else:
        word_ids = []

    return word_ids

def fetch_new_word_ids(shuffle=True):
    """获取当天新词，两轮微间隔"""
    today_str = datetime.date.today().isoformat()
    cursor = get_db().cursor()
    cursor.execute(
        """
        SELECT id FROM IELTS
        WHERE stop_review = 0
        AND (next_review IS NULL OR date_added = ?)
        """,
        (today_str,)
    )
    rows = cursor.fetchall()
    new_word_ids = [row[0] for row in rows]

    if not new_word_ids:
        return []

    # 第一轮和第二轮
    first_round = new_word_ids.copy()
    second_round = new_word_ids.copy()

    if shuffle:
        random.shuffle(first_round)
        random.shuffle(second_round)

    return first_round + second_round


def fetch_review_word_ids(shuffle=True):
    """获取复习旧单词，不包括当天错题集"""
    today_str = datetime.date.today().isoformat()
    cursor = get_db().cursor()
    cursor.execute(
        """
        SELECT id
        FROM IELTS
        WHERE stop_review = 0
          AND next_review IS NOT NULL
          AND next_review <= ?
          AND lapse = 0
        ORDER BY COALESCE(last_remembered, last_forgot, date_added) ASC
        """,
        (today_str,)
    )
    rows = cursor.fetchall()
    review_word_ids = [row[0] for row in rows]

    if shuffle:
        random.shuffle(review_word_ids)

    return review_word_ids

def fetch_lapse_word_ids(shuffle=True):
    """
    获取当日错题集单词 ID 列表（lapse = 3，复习三遍）
    """
    cursor = get_db().cursor()
    # 只拉取当日首次加入错题集的单词
    cursor.execute(
        """
        SELECT id 
        FROM IELTS
        WHERE stop_review = 0
          AND lapse > 0
        ORDER BY last_forgot ASC
        """
    )
    rows = cursor.fetchall()
    base_word_ids = [row[0] for row in rows]

    if not base_word_ids:
        return []

    return base_word_ids

def fetch_spelling_candidates(limit=50):
    """
    从 repetition >= 3 的单词中随机挑选若干用于拼写训练
    挑选规则：
    - 优先 last_spell 为 NULL（从未拼写过）
    - 其次按 last_spell 最早的日期排序
    - 同时将筛选出的单词的 last_spell 更新为今天
    """
    today = datetime.date.today().isoformat()
    cursor = get_db().cursor()

    # 1️⃣ 查询符合条件的单词
    cursor.execute(
        """
        SELECT id
        FROM IELTS
        WHERE stop_review = 0
          AND repetition >= 3
        ORDER BY 
            CASE WHEN last_spell IS NULL THEN 0 ELSE 1 END,
            COALESCE(last_spell, '1970-01-01') ASC
        """
    )
    rows = cursor.fetchall()
    word_ids = [row[0] for row in rows]

    # 2️⃣ 随机抽样限制数量
    if len(word_ids) > limit:
        word_ids = random.sample(word_ids, limit)

    # 3️⃣ 更新 last_spell 为今天
    if word_ids:
        cursor.execute(
            f"""
            UPDATE IELTS
            SET last_spell = ?
            WHERE id IN ({','.join(['?'] * len(word_ids))})
            """,
            [today] + word_ids
        )
        cursor.connection.commit()

    return word_ids
