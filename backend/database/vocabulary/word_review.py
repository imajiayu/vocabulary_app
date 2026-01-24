# -*- coding: utf-8 -*-
"""
复习相关操作
"""
import datetime
from datetime import date, timedelta

from sqlalchemy import func, or_, update, and_

from backend.extensions import get_session
from backend.models.word import Word
from .common import get_current_source


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

    if low_ef_extra_count is None:
        from backend.config import UserConfig
        low_ef_extra_count = UserConfig().LOW_EF_EXTRA_COUNT

    with get_session() as db:
        # 1. 查询到期的单词
        due_rows = db.query(Word.id).filter(
            Word.stop_review == 0,
            Word.next_review != None,
            Word.next_review <= datetime.date.today(),
            Word.source == current_source,
        )
        if limit:
            due_rows = due_rows.limit(limit).all()
        else:
            due_rows = due_rows.all()
        due_ids = [row[0] for row in due_rows]

        # 2. 查询低EF单词
        if low_ef_extra_count > 0:
            today = date.today()
            low_ef_rows = (
                db.query(Word.id)
                .filter(
                    Word.stop_review == 0,
                    Word.source == current_source,
                    ~Word.id.in_(due_ids) if due_ids else True,
                    ~((Word.last_remembered == today) | (Word.last_forgot == today)),
                )
                .order_by(
                    Word.ease_factor.asc(),
                    Word.repetition.asc(),
                )
                .limit(low_ef_extra_count)
                .all()
            )

            low_ef_ids = [row[0] for row in low_ef_rows]
            all_ids = due_ids + low_ef_ids
        else:
            all_ids = due_ids

        return all_ids


def db_fetch_lapse_word_ids(limit=None):
    """获取错题集单词ID列表"""
    from backend.config import get_shuffle_setting

    current_source = get_current_source()
    shuffle = get_shuffle_setting()

    with get_session() as db:
        query = db.query(Word.id).filter(
            Word.stop_review == 0, Word.lapse > 0, Word.source == current_source
        )

        if shuffle:
            query = query.order_by(func.random())
        else:
            query = query.order_by(Word.lapse.asc())

        if limit:
            rows = query.limit(limit).all()
        else:
            rows = query.all()
        return [row[0] for row in rows]


def db_fetch_spelled_word_ids(limit=None):
    """获取需要拼写练习的单词ID列表"""
    current_source = get_current_source()

    with get_session() as db:
        rows = (
            db.query(Word.id)
            .filter(
                Word.stop_review == 0,
                Word.source == current_source,
                or_(
                    Word.repetition >= 3,
                    Word.spell_strength.isnot(None),
                ),
            )
            .order_by(
                Word.spell_next_review.asc(),
                (Word.spell_next_review == None).desc(),
                (Word.spell_strength == None).desc(),
                Word.spell_strength.asc(),
            )
        )
        if limit:
            rows = rows.limit(limit).all()
        else:
            rows = rows.all()
        return [row[0] for row in rows]


def db_fetch_today_spell():
    """获取今天需要拼写的单词ID列表"""
    current_source = get_current_source()
    today = date.today()

    with get_session() as db:
        rows = (
            db.query(Word.id)
            .filter(
                Word.stop_review == 0,
                or_(
                    Word.repetition >= 3,
                    Word.spell_strength.isnot(None),
                ),
                Word.source == current_source,
                (Word.spell_next_review.is_(None)) | (Word.spell_next_review <= today),
            )
            .order_by(
                (Word.spell_next_review == None).asc(),
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
    should_stop_review=False,
):
    """更新复习后的单词状态"""
    with get_session() as db:
        values_dict = {
            "last_remembered": last_remembered,
            "last_forgot": last_forgot,
            "remember_count": Word.remember_count + remember_inc,
            "forget_count": Word.forget_count + forget_inc,
            "repetition": repetition,
            "interval": interval,
            "ease_factor": ease_factor,
            "last_score": last_score,
            "next_review": next_review,
            "lapse": lapse,
            "avg_elapsed_time": avg_elapsed_time,
        }

        if should_stop_review:
            values_dict["stop_review"] = 1

        db.execute(
            update(Word).where(Word.id == id).values(**values_dict)
        )
        db.commit()


def db_update_word_for_lapse(id, lapse):
    """更新lapse值"""
    with get_session() as db:
        db.execute(update(Word).where(Word.id == id).values(lapse=lapse))
        db.commit()


def db_update_word_for_spelling(id, newStrength, nextReview=None):
    """更新拼写强度"""
    with get_session() as db:
        values = {"spell_strength": newStrength}
        if nextReview is not None:
            values["spell_next_review"] = nextReview
        db.execute(update(Word).where(Word.id == id).values(**values))
        db.commit()


def db_get_total_lapse_count():
    """获取总lapse数"""
    current_source = get_current_source()
    with get_session() as db:
        total_lapse = (
            db.query(Word)
            .filter(Word.source == current_source)
            .with_entities(func.sum(Word.lapse))
            .scalar()
        )
        return total_lapse if total_lapse is not None else 0


def db_get_all_sources_counts(sources):
    """
    获取所有 source 的 review/lapse/spelling/today_spell 数量

    Args:
        sources: source 列表

    Returns:
        dict: {source: {review: int, lapse: int, spelling: int, today_spell: int}}
    """
    from backend.config import UserConfig

    config = UserConfig()
    low_ef_extra_count = config.LOW_EF_EXTRA_COUNT
    today = date.today()

    result = {}

    with get_session() as db:
        for source in sources:
            # 1. Review count: 到期单词 + 低EF单词
            due_count = db.query(func.count(Word.id)).filter(
                Word.stop_review == 0,
                Word.next_review != None,
                Word.next_review <= today,
                Word.source == source,
            ).scalar() or 0

            # 低EF单词数量（简化计算，直接加上配置的数量上限）
            review_count = due_count + low_ef_extra_count

            # 2. Lapse count
            lapse_count = db.query(func.count(Word.id)).filter(
                Word.stop_review == 0,
                Word.lapse > 0,
                Word.source == source,
            ).scalar() or 0

            # 3. Spelling count (所有可拼写的单词)
            spelling_count = db.query(func.count(Word.id)).filter(
                Word.stop_review == 0,
                Word.source == source,
                or_(
                    Word.repetition >= 3,
                    Word.spell_strength.isnot(None),
                ),
            ).scalar() or 0

            # 4. Today spell count (今天需要拼写的)
            today_spell_count = db.query(func.count(Word.id)).filter(
                Word.stop_review == 0,
                Word.source == source,
                or_(
                    Word.repetition >= 3,
                    Word.spell_strength.isnot(None),
                ),
                (Word.spell_next_review.is_(None)) | (Word.spell_next_review <= today),
            ).scalar() or 0

            result[source] = {
                "review": review_count,
                "lapse": lapse_count,
                "spelling": spelling_count,
                "today_spell": today_spell_count,
            }

    return result


def adjust_words_for_max_prep_days(max_prep_days):
    """
    当 maxPrepDays 变小时，调整超出范围的单词
    """
    import logging
    logger = logging.getLogger(__name__)

    today = datetime.date.today()
    max_date = today + timedelta(days=max_prep_days)

    with get_session() as db:
        # 1. 调整 interval 超过 max_prep_days 的单词
        affected_interval = db.execute(
            update(Word)
            .where(
                Word.stop_review == 0,
                Word.interval > max_prep_days
            )
            .values(
                interval=max_prep_days,
                next_review=max_date
            )
        ).rowcount

        # 2. 调整 next_review 超出范围的单词
        affected_next_review = db.execute(
            update(Word)
            .where(
                and_(
                    Word.stop_review == 0,
                    Word.next_review != None,
                    Word.next_review > max_date
                )
            )
            .values(next_review=max_date)
        ).rowcount

        # 3. 调整 spell_next_review 超出范围的单词
        affected_spell_next_review = db.execute(
            update(Word)
            .where(
                and_(
                    Word.stop_review == 0,
                    Word.spell_next_review != None,
                    Word.spell_next_review > max_date
                )
            )
            .values(spell_next_review=max_date)
        ).rowcount

        db.commit()

        logger.info(f"调整完成: interval={affected_interval}, next_review={affected_next_review}, spell_next_review={affected_spell_next_review}")
