#!/usr/bin/env python3
"""
复习计划平衡化脚本
削峰填谷，重新分配复习计划以避免高峰和低谷
按source(IELTS/GRE)分别处理，收集零散复习计划
"""

import sqlite3
import argparse
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict, List, Tuple

CONFIG = {
    "daily_review_min": 100,  # 每日最少普通复习数
    "daily_review_max": 300,  # 每日最多普通复习数
    "daily_spell_min": 100,  # 每日最少拼写复习数
    "daily_spell_max": 200,  # 每日最多拼写复习数
}


def get_db_connection():
    """获取数据库连接"""
    return sqlite3.connect("vocabulary.db")


def calculate_priority_score(ease_factor: float, interval: int) -> float:
    """计算优先级分数：ease_factor * interval，值越大越适合推迟"""
    return ease_factor * interval


def load_review_data_by_source(
    conn: sqlite3.Connection, start_date: str, source: str
) -> Tuple[Dict, Dict]:
    """按source加载指定日期之后的复习数据"""
    cursor = conn.cursor()

    # 加载普通复习数据
    cursor.execute(
        """
        SELECT id, next_review, ease_factor, interval
        FROM words
        WHERE next_review >= ? AND next_review IS NOT NULL AND source = ?
        ORDER BY next_review
    """,
        (start_date, source),
    )

    review_words = {}
    review_by_date = defaultdict(list)

    for word_id, next_review, ease_factor, interval in cursor.fetchall():
        priority = calculate_priority_score(ease_factor, interval)
        word_data = {
            "id": word_id,
            "date": next_review,
            "priority": priority,
            "ease_factor": ease_factor,
            "interval": interval,
            "source": source,
        }
        review_words[word_id] = word_data
        review_by_date[next_review].append(word_data)

    # 加载拼写复习数据
    cursor.execute(
        """
        SELECT id, spell_next_review, spell_strength
        FROM words
        WHERE spell_next_review >= ? AND spell_next_review IS NOT NULL AND source = ?
        ORDER BY spell_next_review
    """,
        (start_date, source),
    )

    spell_words = {}
    spell_by_date = defaultdict(list)

    for word_id, spell_next_review, spell_strength in cursor.fetchall():
        # 拼写优先级：spell_strength越低越需要练习，优先级越高（用负值）
        priority = -(spell_strength or 1.0)  # 负值表示优先级高，spell_strength低的优先
        word_data = {
            "id": word_id,
            "date": spell_next_review,
            "priority": priority,
            "spell_strength": spell_strength,
            "source": source,
        }
        spell_words[word_id] = word_data
        spell_by_date[spell_next_review].append(word_data)

    return (review_by_date, spell_by_date)


def balance_schedule_improved(
    words_by_date: Dict, min_count: int, max_count: int, start_date: str
) -> Dict:
    """改进的平衡复习计划，激进地收集零散数据来满足最小限制"""
    dates = sorted(words_by_date.keys())
    if not dates:
        return {}

    changes = {}  # word_id -> new_date

    # 第一阶段：削峰处理
    for date in dates:
        words = words_by_date[date]
        current_count = len(words)

        if current_count > max_count:
            excess_count = current_count - max_count
            # 按优先级排序，优先级低的先推迟（掌握较好的词汇）
            words.sort(key=lambda x: x["priority"])

            words_to_delay = words[:excess_count]
            remaining_words = words[excess_count:]

            # 将超出的词汇分配到后续日期
            for i, word in enumerate(words_to_delay):
                delay_days = (i // 50) + 1  # 每50个词汇推迟一天
                new_date = (
                    datetime.strptime(date, "%Y-%m-%d") + timedelta(days=delay_days)
                ).strftime("%Y-%m-%d")
                changes[word["id"]] = new_date

                # 更新后续日期的词汇列表
                if new_date not in words_by_date:
                    words_by_date[new_date] = []
                words_by_date[new_date].append(word)

            # 更新当前日期的词汇列表
            words_by_date[date] = remaining_words

    # 第二阶段：激进收集零散数据策略（只处理起始日期7天后的）
    dates = sorted(words_by_date.keys())

    # 计算7天后的日期
    start_date_obj = datetime.strptime(start_date, "%Y-%m-%d")
    collection_start_date = (start_date_obj + timedelta(days=7)).strftime("%Y-%m-%d")

    # 设定激进的收集阈值
    collection_threshold = min_count * 0.65  # 65%以下的都收集

    # 先收集所有符合条件的零散词汇（只处理7天后的日期）
    scattered_words = []
    dates_to_clear = []

    for date in dates:
        # 只处理起始日期7天后的日期
        if date >= collection_start_date:
            current_count = len(words_by_date[date])
            # 收集低于阈值的所有词汇
            if current_count < collection_threshold and current_count > 0:
                words = words_by_date[date]
                # 按优先级排序，优先级高的先提前（需要更多练习的词汇）
                words.sort(key=lambda x: x["priority"], reverse=True)
                scattered_words.extend(words)
                dates_to_clear.append(date)

    # 清空这些日期
    for date in dates_to_clear:
        words_by_date[date] = []

    # 第三阶段：重新分配所有收集的词汇
    if scattered_words:
        scattered_words.sort(key=lambda x: x["priority"], reverse=True)

        # 找到需要填充的日期（按时间顺序）
        dates = sorted(
            [
                d
                for d in words_by_date.keys()
                if len(words_by_date[d]) > 0 or d in dates_to_clear
            ]
        )

        # 循环分配词汇到各个日期，优先填满前面的日期
        for word in scattered_words:
            # 找到第一个未满的日期
            target_date = None

            for date in dates:
                current_count = len(words_by_date[date])
                if current_count < max_count:
                    target_date = date
                    break

            # 如果所有现有日期都满了，创建新日期
            if target_date is None:
                if dates:
                    last_date = max(dates)
                    target_date = (
                        datetime.strptime(last_date, "%Y-%m-%d") + timedelta(days=1)
                    ).strftime("%Y-%m-%d")
                else:
                    target_date = start_date
                dates.append(target_date)
                if target_date not in words_by_date:
                    words_by_date[target_date] = []

            changes[word["id"]] = target_date
            words_by_date[target_date].append(word)

    # 第四阶段：最终平衡 - 确保所有日期都满足最小限制
    dates = sorted([d for d in words_by_date.keys() if len(words_by_date[d]) > 0])

    for i, date in enumerate(dates):
        current_count = len(words_by_date[date])

        if current_count < min_count:
            needed_count = min_count - current_count

            # 从后续日期借词汇
            for j in range(i + 1, len(dates)):
                if needed_count <= 0:
                    break

                future_date = dates[j]
                future_words = words_by_date[future_date]

                # 只要后续日期有超过最小限制的词汇就可以借
                if len(future_words) > min_count:
                    available_count = min(needed_count, len(future_words) - min_count)

                    # 按优先级排序，优先级高的先提前
                    future_words.sort(key=lambda x: x["priority"], reverse=True)

                    words_to_advance = future_words[:available_count]
                    remaining_future_words = future_words[available_count:]

                    for word in words_to_advance:
                        changes[word["id"]] = date
                        words_by_date[date].append(word)
                        needed_count -= 1

                    words_by_date[future_date] = remaining_future_words

    return changes


def apply_changes(conn: sqlite3.Connection, review_changes: Dict, spell_changes: Dict):
    """应用更改到数据库"""
    cursor = conn.cursor()

    # 更新普通复习日期
    for word_id, new_date in review_changes.items():
        cursor.execute(
            "UPDATE words SET next_review = ? WHERE id = ?", (new_date, word_id)
        )

    # 更新拼写复习日期
    for word_id, new_date in spell_changes.items():
        cursor.execute(
            "UPDATE words SET spell_next_review = ? WHERE id = ?", (new_date, word_id)
        )

    conn.commit()


def print_statistics(
    review_by_date: Dict, spell_by_date: Dict, source: str, show_all: bool = False
):
    """打印统计信息"""
    print(f"\n=== {source} 平衡前统计 ===")

    limit = None if show_all else 15

    print(f"\n{source} 普通复习:")
    dates = sorted(review_by_date.keys())
    if limit:
        dates = dates[:limit]
    for date in dates:
        count = len(review_by_date[date])
        status = (
            "🔴"
            if count > CONFIG["daily_review_max"]
            else "🟡" if count < CONFIG["daily_review_min"] else "🟢"
        )
        print(f"{date}: {count:3d} {status}")

    print(f"\n{source} 拼写复习:")
    dates = sorted(spell_by_date.keys())
    if limit:
        dates = dates[:limit]
    for date in dates:
        count = len(spell_by_date[date])
        status = (
            "🔴"
            if count > CONFIG["daily_spell_max"]
            else "🟡" if count < CONFIG["daily_spell_min"] else "🟢"
        )
        print(f"{date}: {count:3d} {status}")


def print_balanced_statistics(review_by_date: Dict, spell_by_date: Dict, source: str):
    """打印平衡后统计信息"""
    print(f"\n=== {source} 平衡后预览 ===")

    print(f"\n{source} 普通复习:")
    for date in sorted(review_by_date.keys()):
        count = len(review_by_date[date])
        status = (
            "🔴"
            if count > CONFIG["daily_review_max"]
            else "🟡" if count < CONFIG["daily_review_min"] else "🟢"
        )
        print(f"{date}: {count:3d} {status}")

    print(f"\n{source} 拼写复习:")
    for date in sorted(spell_by_date.keys()):
        count = len(spell_by_date[date])
        status = (
            "🔴"
            if count > CONFIG["daily_spell_max"]
            else "🟡" if count < CONFIG["daily_spell_min"] else "🟢"
        )
        print(f"{date}: {count:3d} {status}")


def main():
    parser = argparse.ArgumentParser(
        description="平衡复习计划，削峰填谷，按source分别处理"
    )
    parser.add_argument("--start-date", required=True, help="开始日期 (YYYY-MM-DD)")
    parser.add_argument(
        "--source",
        choices=["IELTS", "GRE", "both"],
        default="both",
        help="处理的词汇来源",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="预览模式，不实际修改数据库"
    )

    args = parser.parse_args()

    try:
        datetime.strptime(args.start_date, "%Y-%m-%d")
    except ValueError:
        print("错误：日期格式应为 YYYY-MM-DD")
        return

    sources = ["IELTS", "GRE"] if args.source == "both" else [args.source]

    print(f"开始平衡从 {args.start_date} 之后的复习计划...")
    print(f"处理来源: {', '.join(sources)}")
    print(
        f"配置: 普通复习 {CONFIG['daily_review_min']}-{CONFIG['daily_review_max']}, "
        f"拼写复习 {CONFIG['daily_spell_min']}-{CONFIG['daily_spell_max']}"
    )

    conn = get_db_connection()

    try:
        total_review_changes = {}
        total_spell_changes = {}

        for source in sources:
            print(f"\n{'='*50}")
            print(f"处理 {source} 词汇")
            print(f"{'='*50}")

            # 加载数据
            review_by_date, spell_by_date = load_review_data_by_source(
                conn, args.start_date, source
            )

            if not review_by_date and not spell_by_date:
                print(f"没有找到 {source} 的复习数据")
                continue

            print_statistics(
                review_by_date, spell_by_date, source, show_all=args.dry_run
            )

            # 平衡计划
            print(f"\n正在平衡 {source} 复习计划...")
            review_changes = balance_schedule_improved(
                review_by_date,
                CONFIG["daily_review_min"],
                CONFIG["daily_review_max"],
                args.start_date,
            )
            spell_changes = balance_schedule_improved(
                spell_by_date,
                CONFIG["daily_spell_min"],
                CONFIG["daily_spell_max"],
                args.start_date,
            )

            print(f"\n{source} 计划更改:")
            print(f"普通复习: {len(review_changes)} 个词汇")
            print(f"拼写复习: {len(spell_changes)} 个词汇")

            total_review_changes.update(review_changes)
            total_spell_changes.update(spell_changes)

            if args.dry_run:
                print_balanced_statistics(review_by_date, spell_by_date, source)

        print(f"\n{'='*50}")
        print(f"总计更改:")
        print(f"普通复习: {len(total_review_changes)} 个词汇")
        print(f"拼写复习: {len(total_spell_changes)} 个词汇")

        if not args.dry_run:
            if input("\n确认应用所有更改? (y/N): ").lower() == "y":
                apply_changes(conn, total_review_changes, total_spell_changes)
                print("✅ 所有更改已应用到数据库")
            else:
                print("❌ 已取消更改")
        else:
            print("🔍 预览模式：未应用任何更改")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
