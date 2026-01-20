# -*- coding: utf-8 -*-
"""
拼写记忆强度计算和负荷均衡模块

包含拼写强度评估、间隔计算和负荷均衡优化算法
"""
import logging
from backend.config import ReviewLoadLimits
from backend.database.vocabulary_dao import get_daily_spell_loads_by_source

logger = logging.getLogger(__name__)


def calculate_spell_strength(
    spelling_data,
    remembered: bool,
    word: str,
    current_strength: float = None,
    initial_strength: float = 0.0,
) -> tuple[float, dict]:
    """
    计算拼写记忆强度的变化量 - 基于详细的输入行为分析

    :param spelling_data: dict, 包含详细的键盘输入和交互数据
    :param remembered: bool, 是否记住
    :param word: str, 单词文本
    :param current_strength: float, 当前记忆强度（None表示首次）
    :param initial_strength: float, 初始记忆强度
    :return: tuple[float, dict], (spell_strength的变化量, 评分详情字典)
    """
    if current_strength is None:
        current_strength = initial_strength

    if not remembered:
        # 忘记时返回衰减变化量
        new_strength = round(current_strength * 0.3, 2)
        breakdown_info = {
            "remembered": False,
            "strength_gain": round(new_strength - current_strength, 2)
        }
        return new_strength - current_strength, breakdown_info  # 负的变化量

    # 记住时计算新强度并返回变化量
    new_strength, breakdown_info = _calculate_detailed_spell_strength(
        spelling_data, word, current_strength
    )
    breakdown_info["remembered"] = True
    return new_strength - current_strength, breakdown_info  # 正的变化量


def _calculate_detailed_spell_strength(
    spelling_data, word: str, current_strength: float
) -> tuple[float, dict]:
    """
    新版算法 - 基于详细的输入行为分析

    返回: (new_strength, breakdown_info)
    breakdown_info 包含详细的评分信息
    """
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

    # 1. 输入准确性（60%权重） - 合并了原来的基础效率和错误修正
    accuracy_raw = _calculate_input_accuracy(typed_count, backspace_count, word_length, key_events)
    accuracy_score = accuracy_raw * 0.6

    # 2. 输入流畅度分析（20%权重）
    fluency_raw = _analyze_input_fluency(input_analysis, word_length)
    fluency_score = fluency_raw * 0.2

    # 3. 独立性评估（20%权重）
    independence_raw = _analyze_independence(interactions)
    independence_score = independence_raw * 0.2

    # 综合评分
    total_score = accuracy_score + fluency_score + independence_score

    if total_score >= 0.55:
        # 高于临界点：线性映射到 [0.0, 1.0]
        # score: 0.55->1.0 映射到 gain: 0.0->1.0
        strength_gain = (total_score - 0.55) / 0.45 * 1.0
    else:
        # 低于临界点：线性映射到 [-0.7, 0.0]
        # score: 0.0->0.55 映射到 gain: -0.7->0.0
        strength_gain = (total_score / 0.55) * 0.7 - 0.7
    new_strength = current_strength + strength_gain

    # 构建详细的评分信息
    breakdown_info = {
        "typed_count": typed_count,
        "backspace_count": backspace_count,
        "word_length": word_length,
        "avg_key_interval": input_analysis.get("averageKeyInterval", 0),
        "longest_pause": input_analysis.get("longestPause", 0),
        "total_typing_time": input_analysis.get("totalTypingTime", 0),
        "audio_requests": interactions.get("audioRequestCount", 0),
        "accuracy_score": round(accuracy_raw, 3),
        "fluency_score": round(fluency_raw, 3),
        "independence_score": round(independence_raw, 3),
        "weighted_accuracy": round(accuracy_score, 3),
        "weighted_fluency": round(fluency_score, 3),
        "weighted_independence": round(independence_score, 3),
        "total_score": round(total_score, 3),
        "strength_gain": round(strength_gain, 2),
    }

    return round(max(0.0, min(5.0, new_strength)), 2), breakdown_info


def _calculate_input_accuracy(
    typed_count: int, backspace_count: int, word_length: int, key_events: list
) -> float:
    """
    综合评估输入准确性（合并了基础效率和错误修正）

    :param typed_count: 实际输入的字符数（不含Backspace）
    :param backspace_count: 退格次数
    :param word_length: 目标单词长度
    :param key_events: 键盘事件列表
    :return: 准确性得分 (0.0-1.0)
    """
    # 基础准确率：理想情况下 typed_count == word_length
    base_accuracy = word_length / max(1, typed_count)
    base_accuracy = min(1.0, base_accuracy)

    # 分析错误严重程度
    has_modifier_backspace = False
    if key_events:
        has_modifier_backspace = any(
            e.get("key") == "Backspace" and (e.get("metaKey") or e.get("ctrlKey"))
            for e in key_events
        )

    # 根据退格模式应用惩罚
    if has_modifier_backspace:
        # Cmd+退格或Ctrl+退格：删除整个单词/行，表明犯了大错误
        severity_penalty = 0.50
    elif backspace_count >= 10:
        severity_penalty = 0.45  # 大量退格
    elif backspace_count >= 6:
        severity_penalty = 0.35  # 较多退格
    elif backspace_count >= 3:
        severity_penalty = 0.25  # 中等退格
    elif backspace_count >= 1:
        severity_penalty = 0.15  # 少量退格
    else:
        severity_penalty = 0.0  # 无退格

    final_accuracy = base_accuracy - severity_penalty
    return max(0.0, min(1.0, final_accuracy))


def _analyze_input_fluency(input_analysis, word_length: int) -> float:
    """分析输入流畅度 - 基于停顿和节奏"""
    if not input_analysis:
        return 0.5  # 默认中等分数

    total_time = input_analysis.get("totalTypingTime", 1000)  # ms
    longest_pause = input_analysis.get("longestPause", 0)
    avg_interval = input_analysis.get("averageKeyInterval", 0)

    # 时间效率：目标是180ms/字符的打字速度（更合理的标准）
    target_time_per_char = 180  # ms
    expected_time = 500 + word_length * target_time_per_char
    time_efficiency = min(1.0, expected_time / max(1, total_time))

    # 节奏一致性：平均间隔应该较短且一致
    rhythm_score = (
        1.0 if avg_interval <= 200 else max(0.0, 1.0 - (avg_interval - 200) / 600)
    )
    # 停顿惩罚：长时间停顿表示犹豫
    pause_penalty = (
        0.0 if longest_pause <= 800 else min(0.3, 0.3 * (longest_pause - 800) / 2200)
    )

    fluency = time_efficiency * 0.45 + rhythm_score * 0.45 + (1 - pause_penalty) * 0.10
    return max(0.0, min(1.0, fluency))


def _analyze_independence(interactions) -> float:
    """分析学习独立性 - 较少使用提示和帮助"""
    audio_requests = interactions.get("audioRequestCount", 0)

    # 使用帮助的次数越多，独立性分数越低
    # 每次音频请求降低20%的独立性分数
    independence = max(0.0, 1.0 - audio_requests * 0.2)

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


def find_optimal_spell_day(
    base_interval, priority_weight, daily_limit, current_loads, max_delay=None
):
    """
    为低强度拼写找到最优日期，从base_interval向后搜索

    Args:
        base_interval: 基础间隔天数
        priority_weight: 优先级权重（越高越重要）
        daily_limit: 每日限制
        current_loads: 当前负荷分布
        max_delay: 最大允许推迟天数（None表示不限制）
    """
    if not current_loads:
        return base_interval

    # 确定搜索范围（从base_interval开始向后搜索）
    if max_delay is not None:
        search_range = min(base_interval + max_delay, len(current_loads))
    else:
        search_range = min(base_interval + 7, len(current_loads))

    # 两阶段策略：
    # 阶段1：优先填充未满额的天数（硬限制）
    # 阶段2：全部满额后才均衡分配（软限制）

    # 先检查是否有未满额的天数
    for day in range(base_interval, search_range + 1):
        if day <= len(current_loads):
            current_load = current_loads[day - 1]
            if current_load < daily_limit:
                # 找到第一个未满额的天数，直接返回
                return day

    # 所有天数都已满额，进入均衡分配阶段
    best_day = base_interval
    best_score = float("inf")

    for day in range(base_interval, search_range + 1):
        if day <= len(current_loads):
            current_load = current_loads[day - 1]

            # 计算综合评分
            # 时间惩罚：推迟天数越多，惩罚越重
            delay_days = abs(day - base_interval)
            time_penalty = (delay_days**1.5) * (priority_weight**2) * 0.05

            # 负荷惩罚：负荷越高，惩罚越大（实现均匀分布）
            load_ratio = current_load / daily_limit
            load_penalty = (load_ratio**3) * 2.0

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


def calculate_spell_strength_with_load_balancing(
    spelling_data,
    remembered: bool,
    word: str,
    word_source,
    base_date,
    current_strength: float = None,
    initial_strength: float = 0.0,
    base_interval: int = 1,
    max_prep_days: int = 45,
) -> tuple:
    """
    计算拼写记忆强度变化和优化间隔（方案5：组合优化）

    Args:
        spelling_data: 拼写输入数据（键盘事件、交互等）
        remembered: 是否记住
        word: 单词文本
        word_source: 单词来源 (IELTS/GRE)
        base_date: 基准日期（通常是今天），用于计算负荷分布和下次复习日期
        current_strength: 当前拼写强度
        initial_strength: 初始强度（默认0.0）
        base_interval: 基础间隔天数（默认1）
        max_prep_days: 最大准备天数（默认45）

    策略：
    1. 极低强度单词（< 0.8）或未记住：不参与负荷均衡，优先快速复习
    2. 低强度单词（0.8-2.5）：使用指数惩罚 + 严格推迟上限
    3. 高强度单词（> 2.5）：向后寻找负荷较小的日期，避免峰值堆积

    Returns:
        tuple: (strength_change, optimized_interval, breakdown_info)
    """
    # 1. 计算强度变化和评分详情
    strength_change, breakdown_info = calculate_spell_strength(
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
        return strength_change, basic_interval, breakdown_info

    # 5. 低强度单词（0.8-2.5）：应用负荷均衡 + 严格推迟上限
    spell_loads = get_daily_spell_loads_by_source(word_source, base_date, max_prep_days)
    if new_strength <= 2.5:
        try:
            priority_weight = max(0.5, 3.0 - new_strength)

            # 根据强度设置最大推迟天数（缩短为1-3天）
            if new_strength < 1.5:
                max_delay = 1  # 低强度：向后最多1天
            elif new_strength < 2.0:
                max_delay = 2  # 中强度：向后最多2天
            else:  # 2.0-2.5
                max_delay = 3  # 较高强度：向后最多3天

            optimized_interval = find_optimal_spell_day(
                basic_interval,
                priority_weight,
                ReviewLoadLimits.get_daily_spell_limit(),
                spell_loads,
                max_delay=max_delay,
            )
        except Exception as e:
            logger.warning(f"拼写负荷均衡失败，使用原始间隔: {e}")
            optimized_interval = basic_interval

    # 6. 高强度单词（> 2.5）：向后寻找负荷较小的日期
    else:
        try:
            optimized_interval = find_optimal_spell_day_for_strong_words(
                basic_interval,
                ReviewLoadLimits.get_daily_spell_limit(),
                spell_loads,
            )
        except Exception as e:
            logger.warning(f"高强度单词负荷均衡失败，使用原始间隔: {e}")
            optimized_interval = basic_interval

    return strength_change, optimized_interval, breakdown_info
