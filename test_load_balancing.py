#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试负荷均衡逻辑 - 验证"填谷策略"是否能实现均匀分布
"""

import sys
sys.path.insert(0, '/Users/majiayu/vocabulary_app')

from web_app.core.spaced_repetition import find_optimal_spell_day

def test_valley_filling_strategy():
    """测试填谷策略：应该优先填充负荷低的日期"""
    print("=" * 70)
    print("测试：填谷策略（优先选择负荷低的日期）")
    print("=" * 70)

    # 模拟负荷分布：有峰有谷
    current_loads = [
        180,  # Day 1: 接近满
        50,   # Day 2: 空闲（谷）
        170,  # Day 3: 接近满
        60,   # Day 4: 空闲（谷）
        190,  # Day 5: 接近满
    ]

    base_interval = 3
    priority_weight = 1.5
    daily_limit = 200
    max_delay = 3

    print(f"\n负荷分布: {current_loads}")
    print(f"基础间隔: Day {base_interval} (负荷={current_loads[base_interval-1]}/200)")
    print(f"最大推迟: {max_delay}天")
    print(f"搜索范围: Day 1-{min(base_interval + max_delay, len(current_loads))}\n")

    # 🆕 直接调用修改后的函数
    result = find_optimal_spell_day(
        base_interval,
        priority_weight,
        daily_limit,
        current_loads,
        max_delay=max_delay
    )

    # 计算每个候选日期的评分（用于显示）
    print(f"{'日期':<10} {'负荷':<15} {'推迟惩罚':<12} {'负荷惩罚':<12} {'总评分':<10} {'说明'}")
    print("-" * 70)

    best_day = result
    best_score = float('inf')

    for day in range(1, min(base_interval + max_delay + 1, len(current_loads) + 1)):
        current_load = current_loads[day - 1]

        delay_days = abs(day - base_interval)
        time_penalty = (delay_days ** 1.5) * (priority_weight ** 2) * 0.1  # 新权重

        load_ratio = current_load / daily_limit
        load_penalty = (load_ratio ** 3) * 1.0  # 新权重

        total_score = time_penalty + load_penalty

        is_best = "✓ 最优" if day == best_day else ""
        print(f"Day {day:<6} {current_load}/200{' '*6} {time_penalty:<12.3f} {load_penalty:<12.3f} {total_score:<10.3f} {is_best}")

    print("\n" + "=" * 70)
    print(f"✅ 最终选择: Day {best_day} (负荷={current_loads[best_day-1]}/200)")
    print("=" * 70)

    # 验证结果
    if best_day == 2 or best_day == 4:  # 应该选择负荷低的日期
        print("✅ 测试通过：成功选择了负荷较低的日期（填谷策略生效）")
    else:
        print("❌ 测试失败：没有选择负荷最低的日期")


def test_uniform_distribution_simulation():
    """模拟批量调度，验证是否能达到均匀分布"""
    print("\n\n" + "=" * 70)
    print("测试：批量调度模拟（验证均匀分布效果）")
    print("=" * 70)

    # 初始空负荷
    current_loads = [0] * 10
    daily_limit = 200

    # 模拟100个单词的调度
    num_words = 100
    base_intervals = [2, 3, 3, 4, 4, 4, 5, 5, 5, 5]  # 集中在3-5天
    priority_weight = 1.5
    max_delay = 3

    print(f"\n模拟调度 {num_words} 个单词")
    print(f"基础间隔集中在: {set(base_intervals[:10])} 天")
    print(f"最大推迟: {max_delay} 天\n")

    for i in range(num_words):
        base_interval = base_intervals[i % len(base_intervals)]

        # 🆕 直接调用修改后的函数
        best_day = find_optimal_spell_day(
            base_interval,
            priority_weight,
            daily_limit,
            current_loads,
            max_delay=max_delay
        )

        # 更新负荷
        if best_day:
            current_loads[best_day - 1] += 1

    # 显示最终分布
    print("最终负荷分布:")
    print(f"{'日期':<10} {'负荷':<10} {'可视化'}")
    print("-" * 50)

    max_load = max(current_loads[:10])
    total = sum(current_loads[:10])

    for day in range(1, 11):
        load = current_loads[day - 1]
        bar = '█' * int(load / max_load * 30) if max_load > 0 else ''
        print(f"Day {day:<6} {load:<10} {bar}")

    print("-" * 50)
    print(f"总计: {total} 个单词")
    print(f"平均: {total/10:.1f} 个/天")

    # 计算方差
    avg = total / 10
    variance = sum((load - avg) ** 2 for load in current_loads[:10]) / 10
    std_dev = variance ** 0.5

    print(f"标准差: {std_dev:.2f}")

    if std_dev < avg * 0.3:  # 标准差小于平均值的30%
        print("\n✅ 测试通过：负荷分布较为均匀（标准差小）")
    else:
        print("\n⚠️  警告：负荷分布不够均匀（标准差较大）")


if __name__ == "__main__":
    test_valley_filling_strategy()
    test_uniform_distribution_simulation()
