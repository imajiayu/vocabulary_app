#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试复习负荷均衡 - 验证高强度单词向后搜索策略
"""

import sys
sys.path.insert(0, '/Users/majiayu/vocabulary_app')

from web_app.core.spaced_repetition import (
    find_optimal_review_day,
    find_optimal_review_day_for_strong_words,
    should_apply_load_balancing,
    calculate_priority_weight,
)

def test_low_strength_review():
    """测试低强度单词的复习调度（填谷策略）"""
    print("=" * 70)
    print("测试1: 低强度复习单词（填谷策略）")
    print("=" * 70)

    # 模拟负荷分布
    current_loads = [
        250,  # Day 1: 接近满
        80,   # Day 2: 空闲（谷）
        270,  # Day 3: 接近满
        100,  # Day 4: 空闲（谷）
        280,  # Day 5: 接近满
    ]

    base_interval = 3
    ease_factor = 1.8  # 低EF
    score = 3
    daily_limit = 300

    print(f"\n负荷分布: {current_loads}")
    print(f"基础间隔: Day {base_interval}")
    print(f"EF={ease_factor}, score={score}")
    print(f"是否应用负荷均衡: {should_apply_load_balancing(ease_factor, 2, score)}\n")

    result = find_optimal_review_day(
        base_interval,
        ease_factor,
        score,
        daily_limit,
        current_loads
    )

    print(f"✅ 最终选择: Day {result} (负荷={current_loads[result-1]}/300)")

    if result == 2 or result == 4:
        print("✅ 测试通过：成功选择了负荷较低的日期（填谷策略生效）")
    else:
        print(f"⚠️  选择了 Day {result}，负荷={current_loads[result-1]}")


def test_high_strength_review():
    """测试高强度单词的复习调度（向后搜索）"""
    print("\n" + "=" * 70)
    print("测试2: 高强度复习单词（向后搜索策略）")
    print("=" * 70)

    # 模拟负荷：前几天满负荷
    current_loads = [0] * 15
    for i in range(8):
        current_loads[i] = 280  # 前8天接近满
    for i in range(8, 12):
        current_loads[i] = 200  # 9-12天中等
    for i in range(12, 15):
        current_loads[i] = 50   # 13天之后空闲

    daily_limit = 300

    base_intervals = [5, 10]
    ease_factors = [2.8, 3.0]  # 高EF
    scores = [5, 5]

    for i, (base_interval, ease_factor, score) in enumerate(zip(base_intervals, ease_factors, scores)):
        print(f"\n场景 {i+1}:")
        print(f"  基础间隔: Day {base_interval}")
        print(f"  EF={ease_factor}, score={score}")
        print(f"  是否应用负荷均衡: {should_apply_load_balancing(ease_factor, 5, score)}")
        print(f"  原负荷: {current_loads[base_interval-1]}/300")

        result = find_optimal_review_day_for_strong_words(
            base_interval,
            daily_limit,
            current_loads
        )

        delay = result - base_interval
        print(f"  优化结果: Day {result}")
        print(f"  推迟天数: {delay}")
        print(f"  新负荷: {current_loads[result-1]}/300")

        if current_loads[result-1] < current_loads[base_interval-1]:
            print(f"  ✅ 成功降低负荷")
        else:
            print(f"  ✓ 保持原日期（已是最优）")


def test_mixed_scenario():
    """测试混合场景：低强度和高强度单词同时调度"""
    print("\n" + "=" * 70)
    print("测试3: 混合场景（低强度+高强度）")
    print("=" * 70)

    current_loads = [0] * 15
    daily_limit = 30  # 降低限制，容易看出效果

    # 模拟调度
    words = [
        # (base_interval, ease_factor, repetition, score, label)
        (2, 1.5, 1, 2, "低强度1"),
        (3, 1.8, 2, 3, "低强度2"),
        (3, 2.0, 1, 3, "低强度3"),
        (4, 2.8, 5, 5, "高强度1"),
        (5, 3.0, 6, 5, "高强度2"),
        (5, 1.6, 1, 2, "低强度4"),
        (6, 2.9, 5, 5, "高强度3"),
    ] * 5  # 重复5次，共35个单词

    print(f"\n模拟调度 {len(words)} 个单词\n")

    for base_interval, ease_factor, repetition, score, label in words:
        is_low_strength = should_apply_load_balancing(ease_factor, repetition, score)

        if is_low_strength:
            # 低强度：填谷策略
            result = find_optimal_review_day(
                base_interval,
                ease_factor,
                score,
                daily_limit,
                current_loads
            )
        else:
            # 高强度：向后搜索
            result = find_optimal_review_day_for_strong_words(
                base_interval,
                daily_limit,
                current_loads
            )

        if result:
            current_loads[result - 1] += 1

    # 显示结果
    print("最终负荷分布:")
    print(f"{'日期':<10} {'负荷':<10} {'可视化'}")
    print("-" * 60)

    max_load = max(current_loads)
    total = sum(current_loads)

    for day in range(1, 16):
        load = current_loads[day - 1]
        pct = (load / max_load * 100) if max_load > 0 else 0
        bar = '█' * int(load / max_load * 40) if max_load > 0 else ''
        print(f"Day {day:<6} {load:<4} ({pct:>5.1f}%) {bar}")

    print("-" * 60)
    avg = total / 15
    variance = sum((load - avg) ** 2 for load in current_loads) / 15
    std_dev = variance ** 0.5

    print(f"总计: {total} 个单词")
    print(f"平均: {avg:.1f} 个/天")
    print(f"标准差: {std_dev:.2f}")
    print(f"变异系数: {(std_dev/avg)*100:.1f}%")

    if std_dev < avg * 0.5:
        print("\n✅ 负荷分布较均匀（变异系数 < 50%）")
    else:
        print(f"\n⚠️  负荷分布有波动（变异系数 = {(std_dev/avg)*100:.1f}%）")


if __name__ == "__main__":
    test_low_strength_review()
    test_high_strength_review()
    test_mixed_scenario()

    print("\n" + "=" * 70)
    print("测试完成！")
    print("=" * 70)
