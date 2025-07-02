# -*- coding: utf-8 -*-
import datetime
from web_app.utils.db_tools import get_db

# --- 平均停留时间计算（修正版） ---
def calculate_avg_elapsed_time(word_id, elapsed_time):
    """
    返回新的 avg_elapsed_time（不直接写入 DB）
    - 处理 prev_avg 为 NULL 的情况
    - total_reviews = remember_count + forget_count（历史复习次数）
    """
    cursor = get_db().cursor()
    cursor.execute(
        "SELECT avg_elapsed_time, remember_count, forget_count FROM IELTS WHERE id = ?",
        (word_id,)
    )
    row = cursor.fetchone()
    if row is None:
        return elapsed_time  # 单词不存在时直接返回本次 elapsed_time

    prev_avg, remember_count, forget_count = row

    prev_avg = prev_avg or 0
    remember_count = int(remember_count or 0)
    forget_count = int(forget_count or 0)
    total_reviews = remember_count + forget_count

    new_avg = (prev_avg * total_reviews + elapsed_time) / (total_reviews + 1)
    return new_avg


def calculate_score(remembered, elapsed_time, threshold_fast=1, threshold_slow=7):
    """
    结合 remembered 和 elapsed_time 计算 score（整数 1..5）
    - threshold_fast: <= 秒 -> 视为快速答对
    - threshold_slow: >= 秒 -> 视为很慢才答对 (score=3)
    """
    if not remembered:
        return 1

    if elapsed_time <= threshold_fast:
        return 5
    if elapsed_time >= threshold_slow:
        return 3

    # 中间线性映射到 (3, 4.5)
    ratio = (threshold_slow - elapsed_time) / (threshold_slow - threshold_fast)
    raw = 3 + 1.5 * ratio
    score = int(round(raw))

    # clamp
    if score < 1:
        score = 1
    elif score > 5:
        score = 5
    return score

# --- SM-2 EF 更新函数（独立） ---
def sm2_update_ease_factor(ease_factor, score):
    """
    使用 SM-2 的公式更新 EF：
    EF' = EF + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02))
    并下界 clamp 为 1.3
    """
    ef_new = ease_factor + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02))
    if ef_new < 1.3:
        ef_new = 1.3
    return ef_new


# --- SRS 参数计算（修正版） ---
def calculate_srs_parameters(score, interval, repetition, ease_factor):
    """
    根据 score, interval, repetition, ease_factor 计算新的 SRS 参数。
    返回：
      repetition, interval, ease_factor, last_remembered, last_forgot,
      remember_inc, forget_inc, lapse_or_none
    """

    today = datetime.date.today()
    lapse = 0

    # 使用不同的间隔因子来区分 5 / 4 / 3
    # 但 EF 更新使用 SM2 公式（更稳定）
    if score >= 4:
        # 快速或较稳答对，按常规推进
        if repetition == 0:
            new_interval = 1
        elif repetition == 1:
            # 第二次答对，推荐 6 天（SM2 常用）
            new_interval = 6
        else:
            # 第三次及以后按上次 interval * ease_factor
            # 对 score == 4 我们可以略微抑制间隔增长（乘 0.85）
            factor = ease_factor * (0.85 if score == 4 else 1.0)
            new_interval = max(1, int(round(interval * factor)))
        repetition_new = repetition + 1
        # EF 按 SM2 更新（score>=3 时 SM2 会轻微增加）
        ease_factor_new = sm2_update_ease_factor(ease_factor, score)
        last_remembered = today
        last_forgot = None
        remember_inc = 1
        forget_inc = 0

    elif score == 3:
        # 犹豫答对：抑制增长
        if repetition == 0:
            new_interval = 1
        else:
            new_interval = max(1, int(round(interval * ease_factor * 0.7)))
        repetition_new = repetition + 1
        # EF 按 SM2（score=3）会略微下降或小幅变化；也可选择不变，
        ease_factor_new = sm2_update_ease_factor(ease_factor, score)
        last_remembered = today
        last_forgot = None
        remember_inc = 1
        forget_inc = 0

    else:
        # score <= 2 表示答错（我们用 calculate_score 返回 1 代表忘记）
        repetition_new = 0
        new_interval = 1
        # EF 使用 SM2 的下降（score 1 会导致较大下降）
        ease_factor_new = sm2_update_ease_factor(ease_factor, score)
        # 将单词标记为进入错题集（首次加入 lapse=3）
        lapse = 3
        last_remembered = None
        last_forgot = today
        remember_inc = 0
        forget_inc = 1

    return repetition_new, new_interval, ease_factor_new, last_remembered, last_forgot, remember_inc, forget_inc, lapse
