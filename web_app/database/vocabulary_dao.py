# -*- coding: utf-8 -*-
import datetime, time
from datetime import date
import json
from flask import session
from sqlalchemy import func, or_, text, update
from web_app.extensions import get_session
from web_app.models.word import Word, WordRelation
from web_app.services.websocket_events import ws_events


def get_current_source():
    """Get current source filter from session, default to first available source"""
    from web_app.config import UserConfig

    default_source = UserConfig.CUSTOM_SOURCES[0] if UserConfig.CUSTOM_SOURCES else "IELTS"
    return session.get("current_source", default_source)


def db_update_word_definition_only(word_id, definition_dict):
    """
    仅更新单词的释义字段（数据库操作）

    Args:
        word_id: 单词ID
        definition_dict: 释义字典对象

    Returns:
        bool: 是否成功
    """
    try:
        definition_str = json.dumps(definition_dict, ensure_ascii=False)
        with get_session() as db:
            db.execute(
                update(Word).values(definition=definition_str).where(Word.id == word_id)
            )
            db.commit()
        return True
    except Exception as e:
        print(f"Failed to update definition for word_id={word_id}: {e}")
        return False


def db_get_source_statistics():
    """Get statistics for each source (dynamically based on CUSTOM_SOURCES)"""
    from web_app.config import UserConfig

    with get_session() as db:
        stats = {}

        # 动态遍历所有自定义的 sources
        for source in UserConfig.CUSTOM_SOURCES:
            total = db.query(Word).filter(Word.source == source).count()
            remembered = (
                db.query(Word)
                .filter(
                    Word.source == source,
                    (Word.stop_review == 1) | (Word.ease_factor >= 3.0),
                )
                .count()
            )
            unremembered = total - remembered

            stats[source] = {
                "total": total,
                "remembered": remembered,
                "unremembered": unremembered,
            }

        return stats


def db_get_comprehensive_stats(source=None):
    """Single query to get all statistics data for a specific source"""
    source = source or get_current_source()

    with get_session() as db:
        # Single query to get all needed fields
        rows = (
            db.query(
                Word.id,
                Word.word,
                Word.ease_factor,
                Word.avg_elapsed_time,
                Word.next_review,
                Word.remember_count,
                Word.forget_count,
                Word.spell_strength,
                Word.spell_next_review,
                Word.repetition,
                Word.date_added,
                Word.lapse,
                Word.interval,
            )
            .filter(
                Word.source == source,
                Word.stop_review == 0,
                # 排除已经完全掌握的单词（ease_factor达到最高值且复习次数充足）
                ~((Word.ease_factor >= 3.0) & (Word.repetition >= 6)),
            )
            .all()
        )

        # Process data in memory
        stats = {
            "ef_data": [],
            "elapse_times": [],
            "next_reviews": [],
            "spell_next_reviews": [],
            "review_counts": [],
            "spell_strengths": [],
            "added_dates": {},
            "total_lapse": 0,
            "spell_heatmap_cells": [],
            "ef_heatmap_cells": [],
            "intervals": [],
        }

        date_counter = {}
        spell_strengths_for_max = []

        for row in rows:
            # EF data
            if row.ease_factor is not None:
                stats["ef_data"].append(
                    {"word": row.word, "ef": round(row.ease_factor, 2)}
                )

            # Elapse times
            if row.avg_elapsed_time is not None:
                stats["elapse_times"].append(round(row.avg_elapsed_time))

            # Next reviews
            if row.next_review is not None:
                stats["next_reviews"].append(row.next_review)

            # Spell next reviews
            if row.spell_next_review is not None and (
                row.repetition >= 3 or row.spell_strength is not None
            ):
                stats["spell_next_reviews"].append(row.spell_next_review)

            # Review counts
            review_count = (row.remember_count or 0) + (row.forget_count or 0)
            stats["review_counts"].append(review_count)

            # Spell strengths
            available = (row.repetition or 0) >= 3
            stats["spell_strengths"].append(
                {
                    "word": row.word,
                    "strength": (
                        round(row.spell_strength, 2)
                        if row.spell_strength is not None
                        else None
                    ),
                    "available": available,
                }
            )

            # Collect valid spell strengths for max calculation
            if row.spell_strength is not None and available:
                spell_strengths_for_max.append(row.spell_strength)

            # Added dates
            if row.date_added is not None:
                date_str = row.date_added.isoformat()
                date_counter[date_str] = date_counter.get(date_str, 0) + 1

            # Total lapse
            if row.lapse is not None:
                stats["total_lapse"] += row.lapse

            # Intervals
            if row.interval is not None:
                stats["intervals"].append(row.interval)

        # Use fixed max spell strength of 5.0 (not normalized to current data)
        max_spell_strength = 5.0

        # Pre-compute heatmap cells with colors and tooltips
        for row in rows:
            # Spell heatmap cell
            available = (row.repetition or 0) >= 3
            spell_value = row.spell_strength

            # Calculate spell color
            if not available:
                spell_color = "#cbcbcb"
                spell_tooltip = f"{row.word}\n不可拼写"
            elif spell_value is None:
                spell_color = "#4da6ff"
                spell_tooltip = f"{row.word}\n未拼写过"
            else:
                # Green color with alpha based on score (out of 5.0)
                clamped = max(0, min(1, spell_value / max_spell_strength))
                alpha = 0.15 + 0.85 * clamped
                spell_color = f"rgba(46,125,50,{alpha:.3f})"
                spell_tooltip = f"{row.word}\n分数: {spell_value:.1f}"

            stats["spell_heatmap_cells"].append(
                {
                    "word": row.word,
                    "value": spell_value,
                    "available": available,
                    "color": spell_color,
                    "tooltip": spell_tooltip,
                }
            )

            # EF heatmap cell
            ef_value = row.ease_factor

            # Calculate EF color
            if ef_value is None:
                ef_color = "#ffffff"
            elif ef_value <= 1.3:
                ef_color = "#ff4d4f"
            elif ef_value >= 3.0:
                ef_color = "#1890ff"
            elif ef_value == 2.5:
                ef_color = "#ffffff"
            elif ef_value < 2.5:
                # Red to white gradient
                t = (ef_value - 1.3) / (2.5 - 1.3)
                r = 255
                g = round(77 + (255 - 77) * t)
                b = round(77 + (255 - 77) * t)
                ef_color = f"rgb({r},{g},{b})"
            else:
                # White to blue gradient
                t = (ef_value - 2.5) / (3.0 - 2.5)
                r = round(255 - (255 - 24) * t)
                g = round(255 - (255 - 144) * t)
                b = round(255 - (255 - 255) * t)
                ef_color = f"rgb({r},{g},{b})"

            ef_tooltip = (
                f"{row.word}: {ef_value:.2f}"
                if ef_value is not None
                else f"{row.word}: 0.00"
            )

            stats["ef_heatmap_cells"].append(
                {
                    "word": row.word,
                    "value": ef_value,
                    "available": True,
                    "color": ef_color,
                    "tooltip": ef_tooltip,
                }
            )

        # Sort added dates
        stats["added_dates"] = dict(sorted(date_counter.items()))

        return stats


def db_get_word_review_info(id):
    with get_session() as db:
        w = db.query(Word).filter(Word.id == id).first()
        if not w:
            return None

        res = w.to_dict()
        res["related_words"] = w.get_all_related_words(db)

        return res


def db_get_words_review_info_batch(word_ids):
    """Batch query to get word review info - solves N+1 query problem"""
    if not word_ids:
        return []

    with get_session() as db:
        # Single query to get all words
        words = db.query(Word).filter(Word.id.in_(word_ids)).all()

        # Create a mapping for quick lookup
        word_dict = {word.id: word for word in words}
        result = []

        # Maintain the original order of word_ids
        for word_id in word_ids:
            if word_id in word_dict:
                word = word_dict[word_id]
                res = word.to_dict()
                res["related_words"] = word.get_all_related_words(db)
                result.append(res)

        return result


def db_insert_word(word_text, source):
    try:
        with get_session() as db:
            existing = db.query(Word).filter(Word.word == word_text).first()
            if existing:
                return None
            # 设置next_review为当天
            today = date.today()
            new_word = Word(
                word=word_text, source=source, next_review=today
            )
            db.add(new_word)
            db.commit()

            new_word = db.query(Word).filter(Word.word == word_text).first()
            return new_word.to_dict()
    except Exception:
        db.rollback()
        return None


def db_fetch_word_info(word_id):
    with get_session() as db:
        w = db.query(Word).filter_by(id=word_id).first()
        return w.to_dict()


def db_fetch_word_info_for_insert_page():
    with get_session() as db:
        words = db.query(Word).order_by(Word.word.asc()).all()

    return [w.to_dict() for w in words]


def db_fetch_words_without_definition():
    """获取所有 definition 为 null、空字符串或无效释义的单词"""
    # 无效释义的 JSON 字符串（暂无释义）
    invalid_definition = '{"phonetic": {"us": "", "uk": ""}, "definitions": ["暂无释义"], "examples": []}'

    with get_session() as db:
        words = (
            db.query(Word)
            .filter(
                (Word.definition == None)
                | (Word.definition == "")
                | (Word.definition == "{}")
                | (Word.definition == invalid_definition)
            )
            .all()
        )
        return [{"id": w.id, "word": w.word} for w in words]


def db_fetch_word_info_paginated(limit=50, offset=0):
    """Fetch words with pagination support"""
    with get_session() as db:
        # Get total count
        total_count = db.query(Word).count()

        # Get paginated words
        words = (
            db.query(Word).order_by(Word.word.asc()).offset(offset).limit(limit).all()
        )

        has_more = (offset + limit) < total_count

        # Calculate counts for first request only
        counts = None
        if offset == 0:
            from web_app.config import UserConfig

            # Status counts for all words
            remembered_total = (
                db.query(Word)
                .filter((Word.stop_review == 1) | (Word.ease_factor >= 3.0))
                .count()
            )
            unremembered_total = total_count - remembered_total

            # 构建动态的 source_counts
            source_counts = {
                "all": {
                    "total": total_count,
                    "remembered": remembered_total,
                    "unremembered": unremembered_total,
                }
            }

            # 动态遍历所有自定义的 sources
            for source in UserConfig.CUSTOM_SOURCES:
                source_total = db.query(Word).filter(Word.source == source).count()
                source_remembered = (
                    db.query(Word)
                    .filter(
                        Word.source == source,
                        (Word.stop_review == 1) | (Word.ease_factor >= 3.0),
                    )
                    .count()
                )
                source_unremembered = source_total - source_remembered

                source_counts[source] = {
                    "total": source_total,
                    "remembered": source_remembered,
                    "unremembered": source_unremembered,
                }

            counts = {"source_counts": source_counts}

        return {
            "words": [w.to_dict() for w in words],
            "total": total_count,
            "has_more": has_more,
            "counts": counts,
        }


def db_fetch_review_word_ids(limit=None, low_ef_extra_count=None):
    """
    获取需要复习的单词ID列表

    Args:
        limit: 总数限制（可选）
        low_ef_extra_count: 额外拉取的低EF单词数量（可选）

    Returns:
        list: 单词ID列表（到期单词 + 低EF单词，已去重）
    """
    current_source = get_current_source()

    # 如果未指定 low_ef_extra_count，从配置中获取
    if low_ef_extra_count is None:
        from web_app.config import UserConfig

        low_ef_extra_count = UserConfig.LOW_EF_EXTRA_COUNT

    with get_session() as db:
        # 1. 查询到期的单词
        due_rows = db.query(Word.id).filter(
            Word.stop_review == 0,
            Word.next_review != None,
            Word.next_review <= datetime.date.today().isoformat(),
            Word.source == current_source,
            # 排除已经完全掌握的单词（ease_factor达到最高值且复习次数充足）
            ~((Word.ease_factor >= 3.0) & (Word.repetition >= 6)),
        )
        if limit:
            due_rows = due_rows.limit(limit).all()
        else:
            due_rows = due_rows.all()
        due_ids = [row[0] for row in due_rows]

        # 2. 查询低EF单词（排除已到期的单词和完全掌握的单词）
        if low_ef_extra_count > 0:
            today = date.today()
            low_ef_rows = (
                db.query(Word.id)
                .filter(
                    Word.stop_review == 0,
                    Word.source == current_source,
                    # 排除已经完全掌握的单词
                    ~((Word.ease_factor >= 3.0) & (Word.repetition >= 6)),
                    # 排除已到期的单词
                    ~Word.id.in_(due_ids) if due_ids else True,
                    # 排除今天复习过的单词
                    ~((Word.last_remembered == today) | (Word.last_forgot == today)),
                )
                .order_by(
                    Word.ease_factor.asc(),  # EF从低到高排序
                    Word.repetition.asc(),  # 相同EF时，复习次数少的优先
                )
                .limit(low_ef_extra_count)
                .all()
            )

            low_ef_ids = [row[0] for row in low_ef_rows]

            # 3. 合并两个列表（到期单词在前，低EF单词在后）
            all_ids = due_ids + low_ef_ids
        else:
            all_ids = due_ids

        return all_ids


def db_fetch_lapse_word_ids(limit=None):
    current_source = get_current_source()
    with get_session() as db:
        rows = (
            db.query(Word.id)
            .filter(
                Word.stop_review == 0, Word.lapse > 0, Word.source == current_source
            )
            .order_by(Word.lapse.asc())
        )
        if limit:
            rows = rows.limit(limit).all()
        else:
            rows = rows.all()
        return [row[0] for row in rows]


def db_fetch_spelled_word_ids(limit=None):
    current_source = get_current_source()

    with get_session() as db:
        rows = (
            db.query(Word.id)
            .filter(
                Word.stop_review == 0,
                Word.source == current_source,
                or_(
                    Word.repetition >= 3,
                    Word.spell_strength.isnot(None),  # spell_strength 不为 NULL
                ),
                # 包含需要复习的单词：从未练习过拼写或已到复习时间的单词
            )
            .order_by(
                Word.spell_next_review.asc(),  # 按复习时间升序（过期时间越长的越优先）
                (Word.spell_next_review == None).desc(),  # 没有设定复习时间的排在前面
                (Word.spell_strength == None).desc(),  # 从未练习拼写的排在前面
                Word.spell_strength.asc(),  # 最后按强度升序（弱的优先）
            )
        )
        if limit:
            rows = rows.limit(limit).all()
        else:
            rows = rows.all()
        return [row[0] for row in rows]


def db_fetch_today_spell():
    from datetime import date

    current_source = get_current_source()
    today = date.today()

    with get_session() as db:
        rows = (
            db.query(Word.id)
            .filter(
                Word.stop_review == 0,
                or_(
                    Word.repetition >= 3,
                    Word.spell_strength.isnot(None),  # spell_strength 不为 NULL
                ),
                Word.source == current_source,
                # 包含需要复习的单词：从未练习过拼写或已到复习时间的单词
                (Word.spell_next_review.is_(None)) | (Word.spell_next_review <= today),
            )
            .order_by(
                (Word.spell_next_review == None).asc(),  # NULL值排在后面
                Word.spell_next_review.asc(),
            )
        )
        return [row[0] for row in rows]


def db_update_word_for_review(
    id,
    last_remembered,
    last_forgot,
    remember_inc,
    forget_inc,
    repetition,
    interval,
    ease_factor,
    last_score,
    next_review,
    lapse,
    avg_elapsed_time,
):
    with get_session() as db:
        db.execute(
            update(Word)
            .where(Word.id == id)
            .values(
                last_remembered=last_remembered,
                last_forgot=last_forgot,
                remember_count=Word.remember_count + remember_inc,
                forget_count=Word.forget_count + forget_inc,
                repetition=repetition,
                interval=interval,
                ease_factor=ease_factor,
                last_score=last_score,
                next_review=next_review,
                lapse=lapse,
                avg_elapsed_time=avg_elapsed_time,
            )
        )
        db.commit()


def db_update_word_for_lapse(id, lapse):
    with get_session() as db:
        db.execute(update(Word).where(Word.id == id).values(lapse=lapse))
        db.commit()


def db_update_word_for_spelling(id, newStrength, nextReview=None):
    with get_session() as db:
        values = {"spell_strength": newStrength}
        if nextReview is not None:
            values["spell_next_review"] = nextReview
        db.execute(update(Word).where(Word.id == id).values(**values))
        db.commit()


def db_get_word_elapse_info(id):
    with get_session() as db:
        row = (
            db.query(Word.avg_elapsed_time, Word.remember_count, Word.forget_count)
            .filter(Word.id == id)
            .first()
        )
        if not row:
            return None
        return row.avg_elapsed_time, row.remember_count, row.forget_count


# 返回所有lapse的sum
def db_get_total_lapse_count():
    current_source = get_current_source()
    with get_session() as db:
        total_lapse = (
            db.query(Word)
            .filter(Word.source == current_source)
            .with_entities(func.sum(Word.lapse))
            .scalar()
        )
        return total_lapse if total_lapse is not None else 0


def db_delete_word(word_id: int):
    from web_app.models.word import RelationGenerationLog

    with get_session() as db:
        # 1. 删除words_relations中相关的记录
        db.query(WordRelation).filter(
            (WordRelation.word_id == word_id)
            | (WordRelation.related_word_id == word_id)
        ).delete(synchronize_session=False)

        # 2. 删除relation_generation_log中的记录
        db.query(RelationGenerationLog).filter(
            RelationGenerationLog.word_id == word_id
        ).delete(synchronize_session=False)

        # 3. 删除单词本身
        rows = db.query(Word).filter(Word.id == word_id).delete()
        db.commit()
        return rows > 0


def db_batch_delete_words(word_ids: list[int]) -> int:
    """
    批量删除单词及其相关数据

    Args:
        word_ids: 要删除的单词ID列表

    Returns:
        int: 成功删除的单词数量
    """
    from web_app.models.word import RelationGenerationLog

    with get_session() as db:
        # 1. 删除words_relations中相关的记录
        db.query(WordRelation).filter(
            (WordRelation.word_id.in_(word_ids))
            | (WordRelation.related_word_id.in_(word_ids))
        ).delete(synchronize_session=False)

        # 2. 删除relation_generation_log中的记录
        db.query(RelationGenerationLog).filter(
            RelationGenerationLog.word_id.in_(word_ids)
        ).delete(synchronize_session=False)

        # 3. 删除单词本身
        deleted_count = (
            db.query(Word)
            .filter(Word.id.in_(word_ids))
            .delete(synchronize_session=False)
        )

        db.commit()
        return deleted_count


def db_batch_update_words(
    word_ids: list[int], update_data: dict
) -> tuple[int, list[dict]]:
    """
    批量更新单词字段

    Args:
        word_ids: 要更新的单词ID列表
        update_data: 要更新的字段字典

    Returns:
        tuple: (成功更新的单词数量, 更新后的单词列表)
    """
    with get_session() as db:
        # 批量更新
        updated_count = (
            db.query(Word)
            .filter(Word.id.in_(word_ids))
            .update(update_data, synchronize_session=False)
        )

        db.commit()

        # 获取更新后的单词列表
        updated_words = db.query(Word).filter(Word.id.in_(word_ids)).all()
        words_list = [word.to_dict() for word in updated_words]

        return updated_count, words_list


def get_daily_review_loads_by_source(source, base_date, days_ahead=45):
    """
    获取指定source未来每日的复习负荷

    Args:
        source: 单词来源 (IELTS/GRE)
        base_date: 基准日期（通常是今天），从此日期开始计算未来的负荷
        days_ahead: 查询未来多少天的负荷（默认45天）

    Returns:
        list: [day1_count, day2_count, ..., day45_count]
              day1是base_date+1天的负荷，day2是base_date+2天的负荷，以此类推
    """
    from datetime import timedelta

    future_dates = [
        (base_date + timedelta(days=i)).isoformat() for i in range(1, days_ahead + 1)
    ]

    with get_session() as db:
        # 查询每个日期的复习单词数量
        loads = []
        for date_str in future_dates:
            count = (
                db.query(Word.id)
                .filter(
                    Word.source == source,
                    Word.stop_review == 0,
                    Word.next_review == date_str,
                    # 排除已经完全掌握的单词（ease_factor达到最高值且复习次数充足）
                    ~((Word.ease_factor >= 3.0) & (Word.repetition >= 6)),
                )
                .count()
            )
            loads.append(count)

    return loads


def get_daily_spell_loads_by_source(source, base_date, days_ahead=45):
    """
    获取指定source未来每日的拼写负荷

    Args:
        source: 单词来源 (IELTS/GRE)
        base_date: 基准日期（通常是今天），从此日期开始计算未来的负荷
        days_ahead: 查询未来多少天的负荷（默认45天）

    Returns:
        list: [day1_count, day2_count, ..., day45_count]
              day1是base_date+1天的负荷，day2是base_date+2天的负荷，以此类推
    """
    from datetime import timedelta

    future_dates = [
        (base_date + timedelta(days=i)).isoformat() for i in range(1, days_ahead + 1)
    ]

    with get_session() as db:
        loads = []
        for date_str in future_dates:
            count = (
                db.query(Word.id)
                .filter(
                    Word.source == source,
                    Word.stop_review == 0,
                    Word.spell_next_review == date_str,
                )
                .count()
            )
            loads.append(count)

    return loads


def db_update_word(word_id: int, update_data: dict):
    if not update_data:
        # 1. 如果没有提供更新字段，返回错误信息和状态码
        return "没有提供更新字段。", 400, None

    # 构建 SET 子句，使用命名参数
    set_clause = ", ".join([f'"{key}" = :{key}' for key in update_data.keys()])
    sql_query = f'UPDATE "words" SET {set_clause} WHERE id = :id'

    # 构建参数字典
    params = update_data.copy()
    params["id"] = word_id

    try:
        with get_session() as db:
            # 如果更新数据包含word字段，先查询原始的word文本
            original_word = None
            if "word" in update_data:
                original_word_result = (
                    db.query(Word.word).filter(Word.id == word_id).first()
                )
                if original_word_result:
                    original_word = original_word_result[0]

            # 执行 UPDATE
            result = db.execute(text(sql_query), params)
            db.commit()
            if result.rowcount == 0:
                return f"未找到ID为 {word_id} 的单词。", 404, None

            # 关键改动：更新成功后，查询并返回完整的单词对象
            updated_word_result = db.query(Word).filter(Word.id == word_id).first()

            # 将查询结果（通常是 Row 对象）转换为字典，以便 jsonify 转换
            if updated_word_result:
                updated_word = updated_word_result.to_dict()

                # 只有当word文本真正发生变化时才重新查询释义
                if "word" in update_data and original_word != updated_word["word"]:
                    from web_app.services.batch_definition_service import (
                        get_batch_definition_service,
                    )

                    batch_service = get_batch_definition_service()
                    batch_service.add_task(word_id, updated_word["word"])

                return "更新成功", 200, updated_word
            else:
                # 理论上不会执行到这里，但作为安全措施
                return "更新成功，但无法查询到更新后的单词。", 500, None

    except Exception as e:
        db.rollback()
        # 3. 发生异常时，回滚事务并返回错误信息
        return f"发生错误: {str(e)}", 500, None
