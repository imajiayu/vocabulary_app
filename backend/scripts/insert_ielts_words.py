# -*- coding: utf-8 -*-
"""
将 IELTS 单词批量插入数据库
- user_id = 2
- source = "IELTS"
- next_review 从 2025-01-28 开始，每天 50 个
- definition 留空
"""
from datetime import date, timedelta
from pathlib import Path

from backend.extensions import get_session
from backend.models.word import Word


def insert_ielts_words(dry_run=False):
    words_file = Path(__file__).parent.parent / "data" / "ielts_words_clean.txt"

    with open(words_file, "r", encoding="utf-8") as f:
        words = [line.strip() for line in f if line.strip()]

    print(f"待插入单词数: {len(words)}")

    user_id = 2
    source = "IELTS"
    start_date = date(2026, 1, 28)
    words_per_day = 50

    # 计算每个单词的 next_review 日期
    inserted = 0
    skipped = 0

    with get_session() as db:
        for i, word_text in enumerate(words):
            day_offset = i // words_per_day
            next_review = start_date + timedelta(days=day_offset)

            # 检查是否已存在
            existing = db.query(Word).filter(
                Word.user_id == user_id,
                Word.word == word_text,
                Word.source == source
            ).first()

            if existing:
                skipped += 1
                continue

            if dry_run:
                print(f"[DRY RUN] {word_text} -> next_review: {next_review}")
                inserted += 1
                continue

            new_word = Word(
                user_id=user_id,
                word=word_text,
                source=source,
                next_review=next_review,
                date_added=date.today(),
                # 其他字段使用模型默认值
            )
            db.add(new_word)
            inserted += 1

            # 每 500 个提交一次，避免事务过大
            if inserted % 500 == 0:
                db.commit()
                print(f"已插入: {inserted}")

        if not dry_run:
            db.commit()

    print(f"\n插入完成:")
    print(f"  - 新插入: {inserted}")
    print(f"  - 跳过(已存在): {skipped}")
    print(f"  - 分配日期范围: {start_date} ~ {start_date + timedelta(days=(len(words) - 1) // words_per_day)}")


if __name__ == "__main__":
    import sys
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("=== DRY RUN 模式 (不实际写入数据库) ===\n")
    insert_ielts_words(dry_run=dry_run)
