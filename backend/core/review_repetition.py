# -*- coding: utf-8 -*-
import datetime
import logging
import math
from backend.database.vocabulary import (
    db_get_word_elapse_info,
    get_daily_review_loads_by_source,
)
from backend.config import LOW_EF_THRESHOLD, ReviewLoadLimits

logger = logging.getLogger(__name__)


# --- 平均停留时间计算（修正版） ---
def calculate_avg_elapsed_time(word_id, elapsed_time):
    """
    返回新的 avg_elapsed_time（不直接写入 DB）
    - 处理 prev_avg 为 NULL 的情况
    - total_reviews = remember_count + forget_count（历史复习次数）
    """
    info = db_get_word_elapse_info(word_id)
    if info is None:
        return elapsed_time  # 单词不存在时直接返回本次 elapsed_time

    prev_avg, remember_count, forget_count = info

    prev_avg = prev_avg or 0
    remember_count = int(remember_count or 0)
    forget_count = int(forget_count or 0)
    total_reviews = remember_count + forget_count

    new_avg = (prev_avg * total_reviews + elapsed_time) / (total_reviews + 1)
    return new_avg


def calculate_score(remembered, elapsed_time, threshold_fast=2, threshold_slow=5):
    """
    基于认知心理学研究优化的评分函数

    科学依据：
    - 1.5秒：流利性阈值，基于词汇提取研究（Segalowitz & Hulstijn, 2005）
    - 4.0秒：认知负荷临界点，超过此时间表示需要明显努力回忆
    - 使用对数映射更符合人类反应时间的认知模型

    Args:
        remembered: 是否记住
        elapsed_time: 反应时间（秒）
        threshold_fast: 流利性阈值
        threshold_slow: 认知负荷临界点

    Returns:
        score: 1-5的整数评分
    """
    if not remembered:
        return 1

    if elapsed_time <= threshold_fast:
        return 5
    if elapsed_time >= threshold_slow:
        return 3

    # 使用对数映射，更符合认知心理学模型
    # Weber-Fechner定律：感知强度与刺激强度的对数成正比
    log_fast = math.log(threshold_fast)
    log_slow = math.log(threshold_slow)
    log_time = math.log(elapsed_time)

    # 映射到[3, 5]区间
    ratio = (log_slow - log_time) / (log_slow - log_fast)
    raw_score = 3 + 2 * ratio

    # 四舍五入并限制范围
    score = max(1, min(5, round(raw_score)))
    return score


def sm2_update_ease_factor(ease_factor, score, min_ef=1.3, max_ef=3.0):
    """
    基于遗忘曲线和学习心理学优化的EF更新函数

    科学依据：
    - 使用非线性调整，反映真实的学习曲线
    - 高分时奖励更大，符合正强化学习理论
    - 低分时惩罚适中，避免过度惩罚导致学习动机下降
    - 引入EF上限，防止间隔过长导致遗忘

    改进点：
    1. Score 5: 大幅提升EF (+0.15)，奖励流利掌握
    2. Score 4: 适度提升EF (+0.08)，鼓励良好表现
    3. Score 3: 轻微下调EF (-0.02)，表示需要更多练习
    4. Score 2: 中等下调EF (-0.20)，明显增加复习频率
    5. Score 1: 大幅下调EF (-0.40)，但不过度惩罚

    Args:
        ease_factor: 当前难易因子
        score: 1-5的评分
        min_ef: EF最小值
        max_ef: EF最大值

    Returns:
        更新后的EF值
    """
    # 基于认知负荷和学习效率的非线性调整映射
    delta_map = {
        5: 0.15,  # 流利掌握，大幅奖励
        4: 0.08,  # 良好掌握，适度奖励
        3: -0.02,  # 勉强掌握，轻微增加练习
        2: -0.20,  # 困难回忆，明显增加练习
        1: -0.40,  # 完全遗忘，大幅增加练习
    }

    # 应用自适应调整：EF越低，正向调整幅度越大
    delta = delta_map.get(score, 0)
    if score >= 4 and ease_factor < LOW_EF_THRESHOLD:
        # 低EF单词答对时给予额外奖励，促进恢复
        delta *= 1.3

    ef_new = ease_factor + delta

    # 限制EF范围，防止极端值
    return max(min_ef, min(ef_new, max_ef))


# --- SRS 参数计算（修正版） ---
def calculate_srs_parameters(score, interval, repetition, ease_factor, lapse):
    """
    统一 score=3 和 score>=4 的逻辑，增加 EF<=2.0 优先复习处理
    返回：
        repetition_new, interval_new, ease_factor_new, last_remembered, last_forgot,
        remember_inc, forget_inc, lapse
    """
    today = datetime.date.today()

    # 1️⃣ 更新 EF
    ease_factor_new = sm2_update_ease_factor(ease_factor, score)

    if score >= 3:
        # 记住（顺利或犹豫），统一逻辑
        if score == 3:
            growth_factor = 0.3  # 犹豫记住，增长因子较小
        else:
            growth_factor = 1.0  # score >= 4，正常增长

        # 对低 EF 单词加速复习（缩短间隔）
        if ease_factor <= LOW_EF_THRESHOLD:
            shrink_factor = 0.5  # 下次间隔更短
        else:
            shrink_factor = 1.0  # 普通单词

        if repetition == 0:
            interval_new = 1
        elif repetition == 1:
            interval_new = 6 if shrink_factor == 1.0 else 2
        else:
            interval_new = max(
                1,
                int(round(interval * ease_factor_new * growth_factor * shrink_factor)),
            )

        repetition_new = repetition + 1
        last_remembered = today
        last_forgot = None
        remember_inc = 1
        forget_inc = 0

    else:
        # 忘记（score <= 2）
        repetition_new = 0
        interval_new = 1
        # 进入错题集：标记为1（前端维护expanding retrieval practice）
        lapse = 1
        last_remembered = None
        last_forgot = today
        remember_inc = 0
        forget_inc = 1

    return (
        repetition_new,
        interval_new,
        ease_factor_new,
        last_remembered,
        last_forgot,
        remember_inc,
        forget_inc,
        lapse,
    )


def calculate_priority_weight(ease_factor, score):
    """计算优先级权重，数值越小优先级越高"""
    ef_weight = max(0.1, 3.0 - ease_factor)  # EF越低权重越大
    score_weight = max(0.1, 4.0 - score)  # score越低权重越大
    return ef_weight * score_weight


def should_apply_load_balancing(ease_factor, repetition, score):
    """判断是否需要应用负荷均衡"""
    return (
        ease_factor <= LOW_EF_THRESHOLD  # 低EF单词
        or repetition < 3  # 新单词/复习次数少
        or score <= 3  # 表现不佳的单词
    )


def find_optimal_review_day(
    base_interval, ease_factor, score, daily_limit, current_loads
):
    """
    为复习找到最优日期，目标是充分利用每日额度
    """
    if not current_loads:
        return base_interval

    priority_weight = calculate_priority_weight(ease_factor, score)

    # 高优先级单词的搜索范围更小（从base_interval向后搜索）
    if priority_weight > 2.0:  # 高优先级
        offset_range = 1  # 向后最多1天
    elif priority_weight > 1.0:  # 中优先级
        offset_range = 2  # 向后最多2天
    else:  # 低优先级
        offset_range = 3  # 向后最多3天

    # 计算实际搜索范围：从base_interval开始向后搜索
    search_start = base_interval
    search_end = min(len(current_loads), base_interval + offset_range)

    # 两阶段策略：
    # 阶段1：优先填充未满额的天数（硬限制）
    # 阶段2：全部满额后才均衡分配（软限制）

    # 先检查是否有未满额的天数
    for day in range(search_start, search_end + 1):
        if day <= len(current_loads):
            current_load = current_loads[day - 1]
            if current_load < daily_limit:
                # 找到第一个未满额的天数，直接返回
                return day

    # 所有天数都已满额，进入均衡分配阶段
    best_day = base_interval
    best_score = float("inf")

    for day in range(search_start, search_end + 1):
        if day <= len(current_loads):
            current_load = current_loads[day - 1]

            # 计算综合评分
            # 时间惩罚：推迟越多惩罚越大
            time_penalty = abs(day - base_interval) * priority_weight * 0.02

            # 负荷惩罚：负荷越高，惩罚越大（实现均匀分布）
            load_ratio = current_load / daily_limit
            load_penalty = (load_ratio**3) * 2.0

            # 综合评分：两种惩罚相加，越小越好
            total_score = time_penalty + load_penalty

            if total_score < best_score:
                best_score = total_score
                best_day = day

    return best_day


def find_optimal_review_day_for_strong_words(base_interval, daily_limit, current_loads):
    """
    为高强度复习找到最优日期，只允许向后推迟，避免峰值堆积

    对于高强度单词（EF > 2.5, repetition > 3, score > 3）：
    - 从base_interval开始向后搜索
    - 找到负荷小于限制的最早一天
    - 不允许提前，只允许推迟
    - 目标：避免某天出现高低强度单词同时堆积的峰值

    Args:
        base_interval: 基础间隔天数
        daily_limit: 每日限制
        current_loads: 当前负荷分布（长度由max_prep_days决定）

    Returns:
        最优复习日期（天数）
    """
    if not current_loads:
        return base_interval

    # 从base_interval开始向后搜索，范围较大（高强度单词可以推迟更多）
    # len(current_loads)已经由get_daily_review_loads_by_source的days_ahead参数限制
    search_range = min(len(current_loads), base_interval + 15)

    # 首先检查base_interval当天是否可用
    if base_interval <= len(current_loads):
        if current_loads[base_interval - 1] < daily_limit:
            return base_interval

    # 向后搜索负荷最小的一天
    best_day = base_interval
    best_load = float("inf")

    for day in range(base_interval, search_range + 1):
        if day <= len(current_loads):
            current_load = current_loads[day - 1]

            # 如果找到未满额度的日期，立即返回（最早的一天）
            if current_load < daily_limit * 0.7:  # 70%阈值，避免过度填充
                return day

            # 记录负荷最小的一天作为备选
            if current_load < best_load:
                best_load = current_load
                best_day = day

    return best_day


def calculate_srs_parameters_with_load_balancing(
    score,
    interval,
    repetition,
    ease_factor,
    lapse,
    word_source,
    base_date,
    max_prep_days=45,
):
    """
    优化版的SRS参数计算，增加备考时间约束和负荷均衡

    Args:
        score: 评分 (1-5)
        interval: 当前间隔天数
        repetition: 复习次数
        ease_factor: 难易因子
        lapse: 错误次数
        word_source: 单词来源 (IELTS/GRE)
        base_date: 基准日期（通常是今天），用于计算负荷分布和下次复习日期
        max_prep_days: 最大准备天数

    Returns:
        tuple: (repetition_new, interval_new, ease_factor_new, last_remembered,
                last_forgot, remember_inc, forget_inc, lapse)
    """
    # 1. 先用原有逻辑计算基础参数
    basic_result = calculate_srs_parameters(
        score, interval, repetition, ease_factor, lapse
    )
    repetition_new, interval_new, ease_factor_new = basic_result[:3]

    # 2. 应用备考时间约束
    if interval_new > max_prep_days:
        interval_new = max_prep_days

    # 3. 对低强度单词应用负荷均衡（填谷策略）
    # 获取当前负荷分布（从base_date开始计算未来的负荷）
    daily_loads = get_daily_review_loads_by_source(
        word_source, base_date, max_prep_days
    )

    if should_apply_load_balancing(ease_factor_new, repetition_new, score):
        try:
            # 应用负荷均衡（填谷策略）
            interval_new = find_optimal_review_day(
                interval_new,
                ease_factor_new,
                score,
                ReviewLoadLimits.get_daily_review_limit(),
                daily_loads,
            )
        except Exception as e:
            # 如果负荷均衡失败，使用原始间隔
            logger.warning(f"低强度单词负荷均衡失败，使用原始间隔: {e}")

    # 4. 对高强度单词应用向后搜索策略，避免峰值堆积
    else:
        try:
            # 应用向后搜索策略
            interval_new = find_optimal_review_day_for_strong_words(
                interval_new,
                ReviewLoadLimits.get_daily_review_limit(),
                daily_loads,
            )
        except Exception as e:
            # 如果负荷均衡失败，使用原始间隔
            logger.warning(f"高强度单词负荷均衡失败，使用原始间隔: {e}")

    return (repetition_new, interval_new, ease_factor_new) + basic_result[3:]
