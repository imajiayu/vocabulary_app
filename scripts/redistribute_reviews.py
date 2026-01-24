# -*- coding: utf-8 -*-
"""
重新分配单词复习日期和拼写日期的脚本

使用场景：长时间未复习导致大量单词堆积，需要重新规划复习计划

配置参数：
- 每日复习上限：每个 source 50个
- 每日拼写上限：每个 source 50个
- 最大分配天数：90天
- 起始日期：2026-01-25

分配策略：
- 按 source 分组，每个 source 独立分配
- 复习：按 ease_factor 升序排列（越低越难，优先复习）
- 拼写：按 spell_strength 升序排列（越低越弱，优先练习）
"""

import sys
import os
from datetime import date, timedelta
from collections import defaultdict

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.extensions import SessionLocal
from backend.models.word import Word

# ============ 配置参数 ============
DAILY_REVIEW_LIMIT = 50  # 每个 source 每日复习上限
DAILY_SPELL_LIMIT = 50  # 每个 source 每日拼写上限
MAX_DAYS = 90  # 最大分配天数
START_DATE = date(2026, 1, 25)  # 起始日期


def get_session():
    """创建数据库会话"""
    return SessionLocal()


def redistribute_review_dates(session, dry_run=True):
    """
    重新分配复习日期

    策略：按 source 分组，每个 source 内按 ease_factor 升序排列
    """
    # 获取所有需要复习的单词
    words = (
        session.query(Word)
        .filter(Word.stop_review == 0)
        .filter(Word.ease_factor.isnot(None))
        .filter(Word.next_review.isnot(None))
        .order_by(Word.source, Word.ease_factor.asc())
        .all()
    )

    print(f"\n📚 需要重新分配复习日期的单词数量: {len(words)}")

    if not words:
        print("没有需要分配的单词")
        return []

    # 按 source 分组
    words_by_source = defaultdict(list)
    for word in words:
        words_by_source[word.source or "(无source)"].append(word)

    # 统计每个 source
    print(f"\n   按 source 分组统计:")
    for source, source_words in sorted(words_by_source.items()):
        days_needed = (len(source_words) + DAILY_REVIEW_LIMIT - 1) // DAILY_REVIEW_LIMIT
        slots = DAILY_REVIEW_LIMIT * MAX_DAYS
        status = "✅" if len(source_words) <= slots else "⚠️"
        print(f"      {source}: {len(source_words)} 个 → 需要 {days_needed} 天 {status}")

    # 分配日期
    changes = []
    date_counts = defaultdict(int)

    for source, source_words in words_by_source.items():
        for i, word in enumerate(source_words):
            day_offset = min(i // DAILY_REVIEW_LIMIT, MAX_DAYS - 1)
            new_date = START_DATE + timedelta(days=day_offset)

            if word.next_review != new_date:
                changes.append({
                    "word": word.word,
                    "source": word.source,
                    "old_date": word.next_review,
                    "new_date": new_date,
                    "ease_factor": word.ease_factor,
                })
                if not dry_run:
                    word.next_review = new_date

            date_counts[new_date] += 1

    # 显示分配结果统计
    print(f"\n   日期分配统计 (前10天，所有 source 合计):")
    for i, (d, count) in enumerate(sorted(date_counts.items())[:10]):
        print(f"      {d}: {count} 个单词")
    if len(date_counts) > 10:
        print(f"      ... 共 {len(date_counts)} 天")

    print(f"\n   需要更新的单词数量: {len(changes)}")

    return changes


def redistribute_spell_dates(session, dry_run=True):
    """
    重新分配拼写日期

    策略：按 source 分组，每个 source 内按 spell_strength 升序排列
    """
    # 获取所有需要拼写练习的单词
    words = (
        session.query(Word)
        .filter(Word.stop_review == 0)
        .filter(Word.spell_strength.isnot(None))
        .filter(Word.spell_next_review.isnot(None))
        .order_by(Word.source, Word.spell_strength.asc())
        .all()
    )

    print(f"\n✏️  需要重新分配拼写日期的单词数量: {len(words)}")

    if not words:
        print("没有需要分配的单词")
        return []

    # 按 source 分组
    words_by_source = defaultdict(list)
    for word in words:
        words_by_source[word.source or "(无source)"].append(word)

    # 统计每个 source
    print(f"\n   按 source 分组统计:")
    for source, source_words in sorted(words_by_source.items()):
        days_needed = (len(source_words) + DAILY_SPELL_LIMIT - 1) // DAILY_SPELL_LIMIT
        slots = DAILY_SPELL_LIMIT * MAX_DAYS
        status = "✅" if len(source_words) <= slots else "⚠️"
        print(f"      {source}: {len(source_words)} 个 → 需要 {days_needed} 天 {status}")

    # 分配日期
    changes = []
    date_counts = defaultdict(int)

    for source, source_words in words_by_source.items():
        for i, word in enumerate(source_words):
            day_offset = min(i // DAILY_SPELL_LIMIT, MAX_DAYS - 1)
            new_date = START_DATE + timedelta(days=day_offset)

            if word.spell_next_review != new_date:
                changes.append({
                    "word": word.word,
                    "source": word.source,
                    "old_date": word.spell_next_review,
                    "new_date": new_date,
                    "spell_strength": word.spell_strength,
                })
                if not dry_run:
                    word.spell_next_review = new_date

            date_counts[new_date] += 1

    # 显示分配结果统计
    print(f"\n   日期分配统计 (前10天，所有 source 合计):")
    for i, (d, count) in enumerate(sorted(date_counts.items())[:10]):
        print(f"      {d}: {count} 个单词")
    if len(date_counts) > 10:
        print(f"      ... 共 {len(date_counts)} 天")

    print(f"\n   需要更新的单词数量: {len(changes)}")

    return changes


def main():
    print("=" * 60)
    print("单词复习日期重新分配脚本")
    print("=" * 60)
    print(f"\n配置:")
    print(f"  - 起始日期: {START_DATE}")
    print(f"  - 最大分配天数: {MAX_DAYS}")
    print(f"  - 每个 source 每日复习上限: {DAILY_REVIEW_LIMIT}")
    print(f"  - 每个 source 每日拼写上限: {DAILY_SPELL_LIMIT}")
    print(f"  - 数据库: Supabase PostgreSQL")
    print(f"  - 策略: 按 source 分组独立分配")

    session = get_session()

    try:
        # 先进行 dry run 预览
        print("\n" + "=" * 60)
        print("🔍 预览模式 (不会修改数据库)")
        print("=" * 60)

        redistribute_review_dates(session, dry_run=True)
        redistribute_spell_dates(session, dry_run=True)

        # 询问是否执行
        print("\n" + "=" * 60)
        response = input("是否执行更新? (输入 'yes' 确认): ")

        if response.lower() == "yes":
            print("\n🚀 正在执行更新...")

            # 重新获取 session 以确保数据一致性
            session.rollback()

            redistribute_review_dates(session, dry_run=False)
            redistribute_spell_dates(session, dry_run=False)

            session.commit()
            print("\n✅ 更新完成!")
        else:
            print("\n❌ 已取消操作")

    except Exception as e:
        session.rollback()
        print(f"\n❌ 错误: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
