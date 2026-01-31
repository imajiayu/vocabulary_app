# -*- coding: utf-8 -*-
"""
复习相关操作
"""
import datetime
from datetime import date

from sqlalchemy import or_, update

from backend.extensions import get_session
from backend.models.word import Word
from .common import get_current_source


def db_fetch_review_word_ids(limit=None, low_ef_extra_count=None, user_id=1):
    """
    获取需要复习的单词ID列表

    Args:
        limit: 总数限制（可选）
        low_ef_extra_count: 额外拉取的低EF单词数量（可选）
        user_id: 用户ID

    Returns:
        list: 单词ID列表（到期单词 + 低EF单词，已去重）
    """
    current_source = get_current_source()

    if low_ef_extra_count is None:
        from backend.config import UserConfig
        low_ef_extra_count = UserConfig(user_id).LOW_EF_EXTRA_COUNT

    with get_session() as db:
        # 1. 查询到期的单词
        due_rows = db.query(Word.id).filter(
            Word.user_id == user_id,
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
                    Word.user_id == user_id,
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


def db_fetch_spelled_word_ids(limit=None, user_id=1):
    """获取需要拼写练习的单词ID列表"""
    current_source = get_current_source()

    with get_session() as db:
        rows = (
            db.query(Word.id)
            .filter(
                Word.user_id == user_id,
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
    user_id=1,
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
            update(Word).where(Word.id == id, Word.user_id == user_id).values(**values_dict)
        )
        db.commit()


def db_update_word_for_spelling(id, newStrength, nextReview=None, user_id=1):
    """更新拼写强度"""
    with get_session() as db:
        values = {"spell_strength": newStrength}
        if nextReview is not None:
            values["spell_next_review"] = nextReview
        db.execute(update(Word).where(Word.id == id, Word.user_id == user_id).values(**values))
        db.commit()
