# -*- coding: utf-8 -*-
import datetime
from web_app.database.vocabulary_dao import (
    db_get_word_elapse_info,
    get_daily_review_loads_by_source,
    get_daily_spell_loads_by_source,
)
import math


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


def calculate_score(remembered, elapsed_time, threshold_fast=1.5, threshold_slow=4.0):
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
    if score >= 4 and ease_factor < 2.0:
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
        if ease_factor <= 2.0:
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
        lapse = max(3, lapse)  # 进入错题集
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


def calculate_spell_strength(
    spelling_data,
    remembered: bool,
    word: str,
    current_strength: float = None,
    initial_strength: float = 0.0,
) -> float:
    """
    计算拼写记忆强度的变化量 - 基于详细的输入行为分析

    :param spelling_data: dict, 包含详细的键盘输入和交互数据
    :param remembered: bool, 是否记住
    :param word: str, 单词文本
    :param current_strength: float, 当前记忆强度（None表示首次）
    :param initial_strength: float, 初始记忆强度
    :return: float, spell_strength的变化量（可以是正数或负数）
    """
    if current_strength is None:
        current_strength = initial_strength

    if not remembered:
        # 忘记时返回衰减变化量
        new_strength = current_strength * 0.3
        return new_strength - current_strength  # 负的变化量

    # 记住时计算新强度并返回变化量
    new_strength = _calculate_detailed_spell_strength(
        spelling_data, word, current_strength
    )
    return new_strength - current_strength  # 正的变化量


def _calculate_detailed_spell_strength(
    spelling_data, word: str, current_strength: float
) -> float:
    """新版算法 - 基于详细的输入行为分析"""
    word_length = len(word)
    key_events = spelling_data.get("keyEvents", [])
    interactions = spelling_data.get("interactions", {})
    input_analysis = spelling_data.get("inputAnalysis", {})

    # 从keyEvents计算基础统计
    typed_count = len(
        [
            e
            for e in key_events
            if e["key"]
            not in [
                "ArrowLeft",
                "ArrowRight",
                "Tab",
                "Shift",
                "Control",
                "Alt",
                "Meta",
                "Escape",
                "Backspace",
            ]
        ]
    )
    backspace_count = len([e for e in key_events if e["key"] == "Backspace"])

    # 1. 基础输入效率（40%权重）
    base_efficiency = word_length / max(1, typed_count)
    efficiency_score = min(1.0, base_efficiency) * 0.4

    # 2. 输入流畅度分析（25%权重）
    fluency_score = _analyze_input_fluency(input_analysis, word_length) * 0.25

    # 3. 错误修正行为分析（20%权重）
    error_correction_score = (
        _analyze_error_correction(input_analysis, backspace_count, key_events) * 0.2
    )

    # 4. 独立性评估（15%权重）
    independence_score = _analyze_independence(interactions) * 0.15

    # 综合评分
    total_score = (
        efficiency_score + fluency_score + error_correction_score + independence_score
    )

    # 转换为强度增量，允许负增长
    if total_score >= 0.9:
        strength_gain = 1.8  # 卓越表现
    elif total_score >= 0.8:
        strength_gain = 1.5  # 优秀表现
    elif total_score >= 0.7:
        strength_gain = 1.2  # 良好表现
    elif total_score >= 0.6:
        strength_gain = 1.0  # 及格表现
    elif total_score >= 0.5:
        strength_gain = 0.8  # 勉强通过
    elif total_score >= 0.4:
        strength_gain = 0.5  # 表现较差
    elif total_score >= 0.3:
        strength_gain = 0.2  # 表现很差
    elif total_score >= 0.2:
        strength_gain = 0.0  # 无进步
    else:
        strength_gain = -0.2  # 表现极差，实际上是猜出来的，轻微扣分

    new_strength = current_strength + strength_gain
    return max(0.0, min(5.0, new_strength))


def _analyze_input_fluency(input_analysis, word_length: int) -> float:
    """分析输入流畅度 - 基于停顿和节奏"""
    if not input_analysis:
        return 0.5  # 默认中等分数

    total_time = input_analysis.get("totalTypingTime", 1000)  # ms
    longest_pause = input_analysis.get("longestPause", 0)
    avg_interval = input_analysis.get("averageKeyInterval", 0)

    # 时间效率：目标是150ms/字符的打字速度（更合理的标准）
    target_time_per_char = 150  # ms
    expected_time = word_length * target_time_per_char
    time_efficiency = min(1.0, expected_time / max(1, total_time))

    # 节奏一致性：平均间隔应该较短且一致
    rhythm_score = max(0.0, 1.0 - avg_interval / 800)  # 800ms以上算慢

    # 停顿惩罚：长时间停顿表示犹豫
    pause_penalty = min(0.3, longest_pause / 3000)  # 3秒以上的停顿开始显著扣分

    fluency = (time_efficiency * 0.4 + rhythm_score * 0.4) - pause_penalty
    return max(0.0, min(1.0, fluency))


def _analyze_error_correction(
    input_analysis, backspace_count: int, key_events: list = None
) -> float:
    """分析错误修正行为的质量，考虑修饰键的影响"""
    backspace_sequences = input_analysis.get("backspaceSequences", [])
    total_backspaces = backspace_count

    if total_backspaces == 0:
        return 1.0  # 没有错误，完美分数

    # 分析退格类型：普通退格 vs 修饰键退格（Cmd+退格等）
    normal_backspaces = 0
    modifier_backspaces = 0

    # 从 key_events 中分析退格键的使用情况
    if key_events:
        for event in key_events:
            if event.get("key") == "Backspace":
                if event.get("metaKey") or event.get("ctrlKey"):
                    # Cmd+退格或Ctrl+退格：删除整个单词/行，表明犯了大错误
                    modifier_backspaces += 1
                else:
                    # 普通退格：逐字符删除，表明小错误
                    normal_backspaces += 1
    else:
        # 如果没有详细的 key_events 数据，认为都是普通退格
        normal_backspaces = total_backspaces

    # 计算不同类型退格的惩罚
    # 普通退格惩罚（小错误）
    normal_penalty = normal_backspaces * 0.1

    # 修饰键退格惩罚（大错误，删除了更多内容）
    # 一次Cmd+退格相当于删除了多个字符，应该给予更重的惩罚
    modifier_penalty = modifier_backspaces * 0.25

    # 大量退格的额外惩罚
    if total_backspaces >= 10:
        extra_penalty = 0.6  # 严重惩罚
    elif total_backspaces >= 6:
        extra_penalty = 0.4  # 重度惩罚
    elif total_backspaces >= 3:
        extra_penalty = 0.2  # 中度惩罚
    else:
        extra_penalty = 0.0

    # 分析退格序列的特征
    if backspace_sequences:
        sequence_count = len(backspace_sequences)
        avg_correction_size = total_backspaces / max(1, sequence_count)

        # 较少的修正序列 + 每次修正较少字符 = 更好的分数
        sequence_efficiency = max(0.0, 1.0 - sequence_count * 0.15)
        correction_efficiency = max(0.0, 1.0 - avg_correction_size * 0.1)

        base_score = (sequence_efficiency + correction_efficiency) / 2
    else:
        # 没有详细序列数据时的简化评估
        base_score = 0.8  # 给一个较高的基础分数

    # 综合计算：基础分数 - 各种惩罚
    total_penalty = normal_penalty + modifier_penalty + extra_penalty
    final_score = base_score - total_penalty

    return max(0.0, min(1.0, final_score))


def _analyze_independence(interactions) -> float:
    """分析学习独立性 - 较少使用提示和帮助"""
    audio_requests = interactions.get("audioRequestCount", 0)
    forgot_requests = interactions.get("forgotRequestCount", 0)

    # 使用帮助的次数越多，独立性分数越低
    # 忘记按钮的权重更高，因为表示完全不记得
    help_usage = audio_requests + forgot_requests * 2
    independence = max(0.0, 1.0 - help_usage * 0.2)

    return independence


def calculate_next_spell_review(
    strength_change: float,
    original_strength: float,
    remembered: bool,
    base_interval: int = 1,
) -> int:
    """
    基于记忆强度变化量、原始强度和记忆状态计算下次拼写复习间隔（天数）

    :param strength_change: float, 记忆强度的变化量（正数表示增强，负数表示衰减）
    :param original_strength: float, 原始记忆强度
    :param remembered: bool, 是否记住
    :param base_interval: int, 基础间隔天数
    :return: int, 下次复习间隔天数

    使用温和的幂函数增长：interval = base_interval * (1.8 ^ new_strength)
    相比纯指数函数，增长更平缓，更符合人类记忆规律

    间隔示例：
    - 强度 0: 1天
    - 强度 1: 2天 (1.8^1 ≈ 1.8)
    - 强度 2: 3天 (1.8^2 ≈ 3.2)
    - 强度 3: 6天 (1.8^3 ≈ 5.8)
    - 强度 4: 10天 (1.8^4 ≈ 10.5)
    - 强度 5: 19天 (1.8^5 ≈ 18.9)
    """
    # 计算新的记忆强度
    new_strength = original_strength + strength_change

    # 确保强度不会低于0
    new_strength = max(0, new_strength)

    # 如果没记住，使用更短的间隔进行快速复习
    if not remembered:
        return 1  # 完全忘记，明天就复习

    # 记住了的情况，使用正常的间隔计算
    if new_strength <= 0:
        return base_interval  # 强度为0，明天就复习

    # 使用更温和的1.8为底的幂函数，增长平缓但持续
    # 1.8是基于记忆研究的经验值，平衡了学习效率和遗忘风险
    growth_factor = 1.8
    interval = base_interval * (growth_factor**new_strength)

    # 限制最大间隔为180天（6个月），避免过长间隔导致遗忘
    return min(180, max(1, int(round(interval))))


# === 负荷均衡优化算法 ===


class ReviewLoadLimits:
    """每日复习负荷限制配置"""

    DAILY_REVIEW_LIMIT = 300  # 每个source每日复习限制
    DAILY_SPELL_LIMIT = 200  # 每个source每日拼写限制
    MAX_PREP_DAYS = 45  # 最大备考天数


def calculate_priority_weight(ease_factor, score):
    """计算优先级权重，数值越小优先级越高"""
    ef_weight = max(0.1, 3.0 - ease_factor)  # EF越低权重越大
    score_weight = max(0.1, 4.0 - score)  # score越低权重越大
    return ef_weight * score_weight


def should_apply_load_balancing(ease_factor, repetition, score):
    """判断是否需要应用负荷均衡"""
    return (
        ease_factor <= 2.5  # 低EF单词
        or repetition <= 3  # 新单词/复习次数少
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

    # 高优先级单词的搜索范围更小
    if priority_weight > 2.0:  # 高优先级
        search_range = min(3, base_interval + 2)
    elif priority_weight > 1.0:  # 中优先级
        search_range = min(5, base_interval + 3)
    else:  # 低优先级
        search_range = min(7, base_interval + 5)

    # 确保搜索范围不超过current_loads长度
    search_range = min(search_range, len(current_loads))

    best_day = base_interval
    best_score = float("inf")

    # 改为"填谷策略"：优先选择负荷较低的日期，实现均匀分布
    for day in range(1, search_range + 1):
        if day <= len(current_loads):
            current_load = current_loads[day - 1]

            # 计算综合评分
            # 🔧 大幅降低推迟惩罚权重，优先考虑负荷均衡
            time_penalty = abs(day - base_interval) * priority_weight * 0.02

            # 🆕 负荷惩罚：负荷越高，惩罚越大（实现均匀分布）
            # 使用三次方惩罚 + 更大系数，让负荷均衡成为主导因素
            load_ratio = current_load / daily_limit
            load_penalty = (load_ratio ** 3) * 2.0

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
        current_loads: 当前负荷分布

    Returns:
        最优复习日期（天数）
    """
    if not current_loads:
        return base_interval

    # 从base_interval开始向后搜索，范围较大（高强度单词可以推迟更多）
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


def find_optimal_spell_day(base_interval, priority_weight, daily_limit, current_loads, max_delay=None):
    """
    为低强度拼写找到最优日期，使用指数惩罚避免过度推迟

    Args:
        base_interval: 基础间隔天数
        priority_weight: 优先级权重（越高越重要）
        daily_limit: 每日限制
        current_loads: 当前负荷分布
        max_delay: 最大允许推迟天数（None表示不限制）
    """
    if not current_loads:
        return base_interval

    # 确定搜索范围
    if max_delay is not None:
        search_range = min(base_interval + max_delay, len(current_loads))
    else:
        search_range = min(10, base_interval + 7, len(current_loads))

    best_day = base_interval
    best_score = float("inf")

    for day in range(1, search_range + 1):
        if day <= len(current_loads):
            current_load = current_loads[day - 1]

            # 改为"填谷策略"：不限制daily_limit，允许超额，但惩罚拥挤日期
            # 使用指数惩罚：推迟天数越多，惩罚越重
            delay_days = abs(day - base_interval)
            time_penalty = (delay_days ** 1.5) * (priority_weight ** 2) * 0.05

            # 🆕 负荷惩罚：负荷越高，惩罚越大（实现均匀分布）
            # 使用三次方惩罚 + 更大系数，让负荷均衡成为主导因素
            load_ratio = current_load / daily_limit
            load_penalty = (load_ratio ** 3) * 2.0

            # 综合评分：两种惩罚相加，越小越好
            total_score = time_penalty + load_penalty

            if total_score < best_score:
                best_score = total_score
                best_day = day

    return best_day


def find_optimal_spell_day_for_strong_words(base_interval, daily_limit, current_loads):
    """
    为高强度拼写找到最优日期，只允许向后推迟，避免峰值堆积

    对于高强度单词（spell_strength > 2.5）：
    - 从base_interval开始向后搜索
    - 找到负荷小于限制的最早一天
    - 不允许提前，只允许推迟
    - 目标：避免某天出现高低强度单词同时堆积的峰值

    Args:
        base_interval: 基础间隔天数
        daily_limit: 每日限制
        current_loads: 当前负荷分布

    Returns:
        最优复习日期（天数）
    """
    if not current_loads:
        return base_interval

    # 从base_interval开始向后搜索，范围较大（高强度单词可以推迟更多）
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
    score, interval, repetition, ease_factor, lapse, word_source, max_prep_days=45
):
    """
    优化版的SRS参数计算，增加备考时间约束和负荷均衡
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
    if should_apply_load_balancing(ease_factor_new, repetition_new, score):
        try:
            # 获取当前负荷分布
            daily_loads = get_daily_review_loads_by_source(word_source, max_prep_days)

            # 应用负荷均衡（填谷策略）
            interval_new = find_optimal_review_day(
                interval_new,
                ease_factor_new,
                score,
                ReviewLoadLimits.DAILY_REVIEW_LIMIT,
                daily_loads,
            )
        except Exception as e:
            # 如果负荷均衡失败，使用原始间隔
            print(f"低强度单词负荷均衡失败，使用原始间隔: {e}")
            pass

    # 4. 对高强度单词应用向后搜索策略，避免峰值堆积
    else:
        try:
            # 获取当前负荷分布
            daily_loads = get_daily_review_loads_by_source(word_source, max_prep_days)

            # 应用向后搜索策略
            interval_new = find_optimal_review_day_for_strong_words(
                interval_new,
                ReviewLoadLimits.DAILY_REVIEW_LIMIT,
                daily_loads,
            )
        except Exception as e:
            # 如果负荷均衡失败，使用原始间隔
            print(f"高强度单词负荷均衡失败，使用原始间隔: {e}")
            pass

    return (repetition_new, interval_new, ease_factor_new) + basic_result[3:]


def calculate_spell_strength_with_load_balancing(
    spelling_data,
    remembered: bool,
    word: str,
    word_source,
    current_strength: float = None,
    initial_strength: float = 0.0,
    base_interval: int = 1,
    max_prep_days: int = 45,
) -> tuple:
    """
    计算拼写记忆强度变化和优化间隔（方案5：组合优化）

    策略：
    1. 极低强度单词（< 0.8）或未记住：不参与负荷均衡，优先快速复习
    2. 低强度单词（0.8-2.5）：使用指数惩罚 + 严格推迟上限
    3. 高强度单词（> 2.5）：向后寻找负荷较小的日期，避免峰值堆积

    返回: (strength_change, optimized_interval)
    """
    # 1. 计算强度变化
    strength_change = calculate_spell_strength(
        spelling_data, remembered, word, current_strength, initial_strength
    )

    if current_strength is None:
        current_strength = initial_strength

    # 2. 计算基础间隔
    basic_interval = calculate_next_spell_review(
        strength_change, current_strength, remembered, base_interval
    )

    # 3. 应用备考时间约束
    if basic_interval > max_prep_days:
        basic_interval = max_prep_days

    new_strength = current_strength + strength_change

    # 4. 极低强度或未记住的单词：不参与负荷均衡，优先快速复习
    if new_strength < 0.8 or not remembered:
        return strength_change, basic_interval

    # 5. 低强度单词（0.8-2.5）：应用负荷均衡 + 严格推迟上限
    if new_strength <= 2.5:
        try:
            spell_loads = get_daily_spell_loads_by_source(word_source, max_prep_days)
            priority_weight = max(0.5, 3.0 - new_strength)

            # 根据强度设置最大推迟天数
            if new_strength < 1.0:
                max_delay = 1
            elif new_strength < 1.5:
                max_delay = 2
            elif new_strength < 2.0:
                max_delay = 3
            else:  # 2.0-2.5
                max_delay = 5

            optimized_interval = find_optimal_spell_day(
                basic_interval,
                priority_weight,
                ReviewLoadLimits.DAILY_SPELL_LIMIT,
                spell_loads,
                max_delay=max_delay,
            )
        except Exception as e:
            print(f"拼写负荷均衡失败，使用原始间隔: {e}")
            optimized_interval = basic_interval

    # 6. 高强度单词（> 2.5）：向后寻找负荷较小的日期
    else:
        try:
            spell_loads = get_daily_spell_loads_by_source(word_source, max_prep_days)

            optimized_interval = find_optimal_spell_day_for_strong_words(
                basic_interval,
                ReviewLoadLimits.DAILY_SPELL_LIMIT,
                spell_loads,
            )
        except Exception as e:
            print(f"高强度单词负荷均衡失败，使用原始间隔: {e}")
            optimized_interval = basic_interval

    return strength_change, optimized_interval
