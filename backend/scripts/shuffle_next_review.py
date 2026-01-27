# -*- coding: utf-8 -*-
"""
重新随机分配 next_review 日期

问题：单词按首字母顺序插入，导致同一天复习的都是相同首字母
解决：保持每天的单词数量不变，但随机打乱单词分配

用法:
  python -m backend.scripts.shuffle_next_review --dry-run  # 预览
  python -m backend.scripts.shuffle_next_review            # 执行
"""
import random
from collections import defaultdict

from backend.extensions import get_session
from backend.models.word import Word


def shuffle_next_review(user_id=2, source="IELTS", dry_run=False):
    with get_session() as db:
        # 1. 查询所有单词的 (id, next_review)
        words = db.query(Word.id, Word.word, Word.next_review).filter(
            Word.user_id == user_id,
            Word.source == source,
            Word.next_review.isnot(None)
        ).all()

        print(f"查询到 {len(words)} 个单词")

        # 2. 按日期分组，统计每个日期的单词数量
        date_counts = defaultdict(int)
        for w in words:
            date_counts[w.next_review] += 1

        # 按日期排序
        sorted_dates = sorted(date_counts.keys())
        print(f"日期范围: {sorted_dates[0]} ~ {sorted_dates[-1]}")
        print(f"共 {len(sorted_dates)} 天")

        # 显示前几天的分布
        print("\n当前分布 (前5天):")
        for d in sorted_dates[:5]:
            sample_words = [w.word for w in words if w.next_review == d][:5]
            print(f"  {d}: {date_counts[d]} 个, 示例: {sample_words}")

        # 3. 随机打乱所有单词 ID
        word_ids = [w.id for w in words]
        random.shuffle(word_ids)

        # 4. 按原日期分布重新分配
        # 构建 id -> new_date 映射
        id_to_new_date = {}
        idx = 0
        for d in sorted_dates:
            count = date_counts[d]
            for _ in range(count):
                id_to_new_date[word_ids[idx]] = d
                idx += 1

        # 5. 批量更新
        if dry_run:
            print("\n[DRY RUN] 预览新分布 (前5天):")
            for d in sorted_dates[:5]:
                new_word_ids = [wid for wid, date in id_to_new_date.items() if date == d]
                sample_words = [w.word for w in words if w.id in new_word_ids[:5]]
                print(f"  {d}: {len(new_word_ids)} 个, 示例: {sample_words}")
            print("\n[DRY RUN] 未实际更新数据库")
            return

        # 执行更新
        updated = 0
        for word_id, new_date in id_to_new_date.items():
            db.query(Word).filter(Word.id == word_id).update(
                {Word.next_review: new_date}
            )
            updated += 1
            if updated % 500 == 0:
                db.commit()
                print(f"已更新: {updated}")

        db.commit()
        print(f"\n更新完成: {updated} 个单词")

        # 验证新分布
        print("\n新分布 (前5天):")
        for d in sorted_dates[:5]:
            sample = db.query(Word.word).filter(
                Word.user_id == user_id,
                Word.source == source,
                Word.next_review == d
            ).limit(5).all()
            print(f"  {d}: {[w.word for w in sample]}")


if __name__ == "__main__":
    import sys
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("=== DRY RUN 模式 ===\n")
    shuffle_next_review(dry_run=dry_run)
