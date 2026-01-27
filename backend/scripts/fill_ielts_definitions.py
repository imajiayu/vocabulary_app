# -*- coding: utf-8 -*-
"""
为 IELTS 单词批量填充释义

策略：
1. 优先从 user_id=1 复制相同单词的释义（批量更新）
2. 找不到时从有道词典爬取

用法：
    python -m backend.scripts.fill_ielts_definitions
    python -m backend.scripts.fill_ielts_definitions --dry-run
"""
import json
import time
import sys
from datetime import datetime

from sqlalchemy import update

from backend.extensions import get_session
from backend.models.word import Word
from backend.services.vocabulary_service import fetch_definition_from_web


def fill_definitions(dry_run=False):
    """填充 IELTS 单词的释义"""

    # 统计
    stats = {
        "total": 0,
        "copied": 0,
        "fetched": 0,
        "failed": [],
    }

    with get_session() as db:
        # 1. 查询需要填充的单词 (user_id=2, source='IELTS', definition IS NULL)
        words_to_fill = db.query(Word.id, Word.word).filter(
            Word.user_id == 2,
            Word.source == "IELTS",
            Word.definition == None
        ).all()

        stats["total"] = len(words_to_fill)
        print(f"需要填充释义的单词: {stats['total']}")

        if stats["total"] == 0:
            print("没有需要填充的单词")
            return stats

        # 2. 预加载 user_id=1 的所有单词释义 (用于复制)
        user1_words = db.query(Word.word, Word.definition).filter(
            Word.user_id == 1,
            Word.definition != None
        ).all()

        user1_definitions = {w.word: w.definition for w in user1_words}
        print(f"user_id=1 中有释义的单词: {len(user1_definitions)}")

        # 3. 分离：可复制 vs 需爬取
        to_copy = []  # [(word_id, definition), ...]
        to_fetch = []  # [(word_id, word_text), ...]

        for word_id, word_text in words_to_fill:
            if word_text in user1_definitions:
                to_copy.append((word_id, user1_definitions[word_text]))
            else:
                to_fetch.append((word_id, word_text))

        print(f"可复制: {len(to_copy)}, 需爬取: {len(to_fetch)}")

        start_time = datetime.now()

        # 4. 批量复制（快速）
        if to_copy and not dry_run:
            batch_size = 500
            for i in range(0, len(to_copy), batch_size):
                batch = to_copy[i:i + batch_size]
                for word_id, definition in batch:
                    db.execute(
                        update(Word).where(Word.id == word_id).values(definition=definition)
                    )
                db.commit()
                stats["copied"] = i + len(batch)
                elapsed = (datetime.now() - start_time).total_seconds()
                print(f"[复制] {stats['copied']}/{len(to_copy)}, 耗时: {elapsed:.1f}s")
        else:
            stats["copied"] = len(to_copy)

        # 5. 逐个爬取（需要延时）
        if to_fetch:
            print(f"\n开始爬取 {len(to_fetch)} 个单词...")
            for i, (word_id, word_text) in enumerate(to_fetch):
                if not dry_run:
                    time.sleep(0.3)  # 稍微减少间隔
                    fetched = fetch_definition_from_web(word_text)
                    if fetched:
                        definition = json.dumps(fetched, ensure_ascii=False)
                        db.execute(
                            update(Word).where(Word.id == word_id).values(definition=definition)
                        )
                        stats["fetched"] += 1
                    else:
                        stats["failed"].append(word_text)

                    # 每个都提交，避免丢失
                    db.commit()
                else:
                    stats["fetched"] += 1

                # 进度
                if (i + 1) % 10 == 0 or (i + 1) == len(to_fetch):
                    elapsed = (datetime.now() - start_time).total_seconds()
                    print(f"[爬取] {i + 1}/{len(to_fetch)}, "
                          f"成功: {stats['fetched']}, 失败: {len(stats['failed'])}, "
                          f"耗时: {elapsed:.1f}s")

    # 打印汇总
    print("\n" + "=" * 50)
    print("填充完成:")
    print(f"  - 总数: {stats['total']}")
    print(f"  - 从 user_id=1 复制: {stats['copied']}")
    print(f"  - 从有道词典爬取: {stats['fetched']}")
    print(f"  - 失败: {len(stats['failed'])}")

    if stats["failed"]:
        print(f"\n失败的单词 ({len(stats['failed'])} 个):")
        for w in stats["failed"][:20]:
            print(f"  - {w}")
        if len(stats["failed"]) > 20:
            print(f"  ... 还有 {len(stats['failed']) - 20} 个")

    return stats


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("=== DRY RUN 模式 (不实际写入数据库，不发送网络请求) ===\n")
    fill_definitions(dry_run=dry_run)
