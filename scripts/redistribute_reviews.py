# -*- coding: utf-8 -*-
"""
重新分配单词复习日期和拼写日期的脚本

使用场景：长时间未复习导致大量单词堆积，需要重新规划复习计划

配置参数：
- 每日复习上限：200个
- 每日拼写上限：100个
- 最大分配天数：60天
- 起始日期：2026-01-16

分配策略：
- 复习：按 ease_factor 升序排列（越低越难，优先复习）
- 拼写：按 spell_strength 升序排列（越低越弱，优先练习）
"""

import sys
import os
from datetime import date, timedelta

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.models.word import Word, Base

# ============ 配置参数 ============
DAILY_REVIEW_LIMIT = 200      # 每日复习上限
DAILY_SPELL_LIMIT = 100       # 每日拼写上限
MAX_DAYS = 60                 # 最大分配天数
START_DATE = date(2026, 1, 16)  # 起始日期

# 数据库路径 (在项目根目录)
DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "vocabulary.db"
)


def get_session():
    """创建数据库会话"""
    engine = create_engine(f"sqlite:///{DB_PATH}")
    Session = sessionmaker(bind=engine)
    return Session()


def redistribute_review_dates(session, dry_run=True):
    """
    重新分配复习日期

    策略：按 ease_factor 升序排列，越难的单词越早复习
    """
    # 获取所有需要复习的单词（未停止复习且 ease_factor 不为空）
    words = (
        session.query(Word)
        .filter(Word.stop_review == 0)
        .filter(Word.ease_factor.isnot(None))
        .filter(Word.next_review.isnot(None))  # 已经进入复习流程的单词
        .order_by(Word.ease_factor.asc())  # ease_factor 越低越优先
        .all()
    )

    print(f"\n📚 需要重新分配复习日期的单词数量: {len(words)}")

    if not words:
        print("没有需要分配的单词")
        return

    # 计算每天分配的数量
    total_slots = DAILY_REVIEW_LIMIT * MAX_DAYS
    print(f"   总可用槽位: {total_slots} ({DAILY_REVIEW_LIMIT}/天 × {MAX_DAYS}天)")

    if len(words) > total_slots:
        print(f"   ⚠️  警告: 单词数量 ({len(words)}) 超过总槽位 ({total_slots})")
        print(f"      超出的单词将被分配到第 {MAX_DAYS} 天")

    # 分配日期
    changes = []
    for i, word in enumerate(words):
        day_offset = min(i // DAILY_REVIEW_LIMIT, MAX_DAYS - 1)
        new_date = START_DATE + timedelta(days=day_offset)

        if word.next_review != new_date:
            changes.append({
                "word": word.word,
                "old_date": word.next_review,
                "new_date": new_date,
                "ease_factor": word.ease_factor
            })
            if not dry_run:
                word.next_review = new_date

    # 显示分配结果统计
    date_counts = {}
    for word in words:
        day_offset = min(words.index(word) // DAILY_REVIEW_LIMIT, MAX_DAYS - 1)
        new_date = START_DATE + timedelta(days=day_offset)
        date_counts[new_date] = date_counts.get(new_date, 0) + 1

    print(f"\n   日期分配统计 (前10天):")
    for i, (d, count) in enumerate(sorted(date_counts.items())[:10]):
        print(f"      {d}: {count} 个单词")
    if len(date_counts) > 10:
        print(f"      ... 共 {len(date_counts)} 天")

    print(f"\n   需要更新的单词数量: {len(changes)}")

    return changes


def redistribute_spell_dates(session, dry_run=True):
    """
    重新分配拼写日期

    策略：按 spell_strength 升序排列，越弱的单词越早练习
    """
    # 获取所有需要拼写练习的单词
    words = (
        session.query(Word)
        .filter(Word.stop_review == 0)
        .filter(Word.spell_strength.isnot(None))
        .filter(Word.spell_next_review.isnot(None))  # 已经进入拼写流程的单词
        .order_by(Word.spell_strength.asc())  # spell_strength 越低越优先
        .all()
    )

    print(f"\n✏️  需要重新分配拼写日期的单词数量: {len(words)}")

    if not words:
        print("没有需要分配的单词")
        return

    # 计算每天分配的数量
    total_slots = DAILY_SPELL_LIMIT * MAX_DAYS
    print(f"   总可用槽位: {total_slots} ({DAILY_SPELL_LIMIT}/天 × {MAX_DAYS}天)")

    if len(words) > total_slots:
        print(f"   ⚠️  警告: 单词数量 ({len(words)}) 超过总槽位 ({total_slots})")
        print(f"      超出的单词将被分配到第 {MAX_DAYS} 天")

    # 分配日期
    changes = []
    for i, word in enumerate(words):
        day_offset = min(i // DAILY_SPELL_LIMIT, MAX_DAYS - 1)
        new_date = START_DATE + timedelta(days=day_offset)

        if word.spell_next_review != new_date:
            changes.append({
                "word": word.word,
                "old_date": word.spell_next_review,
                "new_date": new_date,
                "spell_strength": word.spell_strength
            })
            if not dry_run:
                word.spell_next_review = new_date

    # 显示分配结果统计
    date_counts = {}
    for i, word in enumerate(words):
        day_offset = min(i // DAILY_SPELL_LIMIT, MAX_DAYS - 1)
        new_date = START_DATE + timedelta(days=day_offset)
        date_counts[new_date] = date_counts.get(new_date, 0) + 1

    print(f"\n   日期分配统计 (前10天):")
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
    print(f"  - 每日复习上限: {DAILY_REVIEW_LIMIT}")
    print(f"  - 每日拼写上限: {DAILY_SPELL_LIMIT}")
    print(f"  - 数据库路径: {DB_PATH}")

    # 检查数据库是否存在
    if not os.path.exists(DB_PATH):
        print(f"\n❌ 错误: 数据库文件不存在: {DB_PATH}")
        sys.exit(1)

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

        if response.lower() == 'yes':
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
