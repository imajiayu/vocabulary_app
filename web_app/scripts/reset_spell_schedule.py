#!/usr/bin/env python3
"""
重新设置单词的拼写复习时间表

按照优先级分配每天的拼写单词：
1. repetition >= 3 但 spell_strength IS NULL（新拼写单词）
2. spell_strength IS NOT NULL，按 spell_strength 升序（拼写强度弱的优先）

每天最多分配 300 个单词，从 2025-10-18 开始
"""

import sys
import os
from datetime import date, timedelta
from collections import defaultdict

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from web_app.extensions import get_session
from web_app.models.word import Word


def get_spelling_candidates(source):
    """获取符合拼写条件的单词，按优先级排序"""
    with get_session() as db:
        # 第一组：repetition >= 3 但 spell_strength IS NULL
        group1 = (
            db.query(Word)
            .filter(
                Word.stop_review == 0,
                Word.source == source,
                Word.repetition >= 3,
                Word.spell_strength.is_(None),
            )
            .order_by(Word.id.asc())  # 按ID排序，确保顺序一致
            .all()
        )

        # 第二组：spell_strength IS NOT NULL，按 spell_strength 升序
        group2 = (
            db.query(Word)
            .filter(
                Word.stop_review == 0,
                Word.source == source,
                Word.spell_strength.isnot(None),
            )
            .order_by(Word.spell_strength.asc(), Word.id.asc())
            .all()
        )

        print(f"\n{source} 来源统计:")
        print(f"  第一组（新拼写单词，repetition >= 3）: {len(group1)} 个")
        print(f"  第二组（已有拼写记录）: {len(group2)} 个")
        print(f"  总计: {len(group1) + len(group2)} 个")

        # 合并两组，第一组优先
        return group1 + group2


def assign_spell_schedule(words, start_date, words_per_day=300):
    """为单词分配拼写复习时间"""
    schedule = defaultdict(list)
    current_date = start_date
    count_for_today = 0

    for word in words:
        # 如果当天已满，移到下一天
        if count_for_today >= words_per_day:
            current_date += timedelta(days=1)
            count_for_today = 0

        schedule[current_date].append(word)
        count_for_today += 1

    return schedule


def print_schedule_summary(schedule):
    """打印时间表摘要"""
    print("\n每日拼写单词分配:")
    print("=" * 60)

    for day in sorted(schedule.keys()):
        words = schedule[day]
        print(f"{day.strftime('%Y-%m-%d')}: {len(words):3d} 个单词")

    print("=" * 60)
    total = sum(len(words) for words in schedule.values())
    print(f"总计: {total} 个单词，分配到 {len(schedule)} 天")


def apply_schedule(schedule, dry_run=True):
    """应用时间表到数据库"""
    if dry_run:
        print("\n[DRY RUN] 以下是将要执行的更新（不会实际修改数据库）:")
        print("-" * 60)

        # 显示前10个单词的详情作为示例
        count = 0
        for day in sorted(schedule.keys()):
            for word in schedule[day]:
                if count < 10:
                    print(
                        f"  {word.word:20s} -> spell_next_review: {day.strftime('%Y-%m-%d')} "
                        f"(rep={word.repetition}, spell_strength={word.spell_strength})"
                    )
                    count += 1
                else:
                    break
            if count >= 10:
                break

        if sum(len(words) for words in schedule.values()) > 10:
            print(f"  ... 还有 {sum(len(words) for words in schedule.values()) - 10} 个单词")

        print("-" * 60)
        return 0

    # 实际执行更新
    updated_count = 0
    with get_session() as db:
        for day, words in schedule.items():
            # 提取单词ID列表
            word_ids = [word.id for word in words]

            # 批量更新这些单词的 spell_next_review
            db.query(Word).filter(Word.id.in_(word_ids)).update(
                {Word.spell_next_review: day},
                synchronize_session=False
            )
            updated_count += len(word_ids)

        db.commit()
        print(f"\n✓ 成功更新 {updated_count} 个单词的 spell_next_review")

    return updated_count


def main():
    """主函数"""
    import argparse

    parser = argparse.ArgumentParser(
        description="重新设置单词的拼写复习时间表",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # Dry run 模式（仅查看，不修改）
  python web_app/scripts/reset_spell_schedule.py --dry-run

  # 实际执行更新
  python web_app/scripts/reset_spell_schedule.py

  # 自定义起始日期和每日单词数
  python web_app/scripts/reset_spell_schedule.py --start-date 2025-10-20 --words-per-day 200

  # 只处理特定来源
  python web_app/scripts/reset_spell_schedule.py --source IELTS
        """,
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Dry run 模式，仅显示将要执行的操作，不实际修改数据库",
    )
    parser.add_argument(
        "--start-date",
        type=str,
        default="2025-10-18",
        help="起始日期（格式：YYYY-MM-DD），默认为 2025-10-18",
    )
    parser.add_argument(
        "--words-per-day",
        type=int,
        default=300,
        help="每天最多分配的单词数，默认为 300",
    )
    parser.add_argument(
        "--source",
        type=str,
        choices=["IELTS", "GRE", "both"],
        default="both",
        help="处理的单词来源，默认为 both（两个都处理）",
    )

    args = parser.parse_args()

    # 解析起始日期
    try:
        start_date = date.fromisoformat(args.start_date)
    except ValueError:
        print(f"错误：无效的日期格式 '{args.start_date}'，请使用 YYYY-MM-DD 格式")
        sys.exit(1)

    print("=" * 60)
    print("拼写复习时间表重置工具")
    print("=" * 60)
    print(f"模式: {'DRY RUN（仅查看）' if args.dry_run else '实际执行'}")
    print(f"起始日期: {start_date.strftime('%Y-%m-%d')}")
    print(f"每天单词数: {args.words_per_day}")
    print(f"处理来源: {args.source}")

    # 确定要处理的来源
    sources = ["IELTS", "GRE"] if args.source == "both" else [args.source]

    # 分别处理每个来源
    for source in sources:
        print(f"\n\n{'=' * 60}")
        print(f"处理 {source} 来源的单词")
        print("=" * 60)

        # 获取候选单词
        words = get_spelling_candidates(source)

        if not words:
            print(f"没有符合条件的 {source} 单词")
            continue

        # 分配时间表
        schedule = assign_spell_schedule(
            words, start_date, words_per_day=args.words_per_day
        )

        # 打印摘要
        print_schedule_summary(schedule)

        # 应用时间表
        apply_schedule(schedule, dry_run=args.dry_run)

    if args.dry_run:
        print("\n" + "=" * 60)
        print("这是 DRY RUN 模式，没有修改任何数据")
        print("如果确认无误，请去掉 --dry-run 参数重新运行以实际执行更新")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("✓ 所有更新已完成")
        print("=" * 60)


if __name__ == "__main__":
    main()
