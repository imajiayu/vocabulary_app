# -*- coding: utf-8 -*-
"""
统计查询
"""
from datetime import timedelta

from sqlalchemy import func, text

from backend.extensions import get_session
from backend.models.word import Word


def db_get_source_stats_from_view(source: str):
    """
    从 word_source_stats view 获取单个 source 的统计数据

    View 在 Supabase 中定义，使用 COUNT(*) FILTER 语法单次扫描计算所有指标

    Args:
        source: 单词来源 (如 "IELTS", "GRE")

    Returns:
        dict: {
            "counts": {"review": int, "lapse": int, "spelling": int, "today_spell": int},
            "source_stats": {"total": int, "remembered": int, "unremembered": int}
        }
    """
    from backend.config import UserConfig

    config = UserConfig()
    low_ef_extra_count = config.LOW_EF_EXTRA_COUNT

    with get_session() as db:
        result = db.execute(
            text("SELECT * FROM word_source_stats WHERE source = :source"),
            {"source": source}
        ).fetchone()

        if result is None:
            return {
                "counts": {"review": 0, "lapse": 0, "spelling": 0, "today_spell": 0},
                "source_stats": {"total": 0, "remembered": 0, "unremembered": 0}
            }

        return {
            "counts": {
                "review": (result.due_count or 0) + low_ef_extra_count,
                "lapse": result.lapse_count or 0,
                "spelling": result.spelling_count or 0,
                "today_spell": result.today_spell_count or 0,
            },
            "source_stats": {
                "total": result.total or 0,
                "remembered": result.remembered or 0,
                "unremembered": result.unremembered or 0,
            }
        }


def db_get_source_statistics():
    """Get statistics for each source

    优化：使用单次分组查询代替 N×2 次循环查询
    """
    from sqlalchemy import case
    from backend.config import UserConfig

    with get_session() as db:
        # 单次分组查询获取所有 source 的统计
        results = (
            db.query(
                Word.source,
                func.count(Word.id).label("total"),
                func.sum(case((Word.stop_review == 1, 1), else_=0)).label("remembered"),
            )
            .group_by(Word.source)
            .all()
        )

        # 构建结果映射
        stats_map = {r.source: {"total": r.total, "remembered": r.remembered} for r in results}

        # 确保所有配置的 source 都有数据（即使为空）
        stats = {}
        for source in UserConfig().CUSTOM_SOURCES:
            data = stats_map.get(source, {"total": 0, "remembered": 0})
            stats[source] = {
                "total": data["total"],
                "remembered": data["remembered"],
                "unremembered": data["total"] - data["remembered"],
            }

        return stats


def get_daily_review_loads_by_source(source, base_date, days_ahead=45):
    """获取指定source未来每日的复习负荷

    优化：使用单次分组查询代替 45-90 次循环查询
    """
    with get_session() as db:
        # 计算日期范围
        future_dates = [base_date + timedelta(days=i) for i in range(1, days_ahead + 1)]

        # 单次分组查询获取所有日期的计数
        results = (
            db.query(Word.next_review, func.count(Word.id))
            .filter(
                Word.source == source,
                Word.stop_review == 0,
                Word.next_review.in_(future_dates),
            )
            .group_by(Word.next_review)
            .all()
        )

        # 构建日期到计数的映射
        date_counts = {date: count for date, count in results}

        # 按顺序返回每天的负荷（未出现的日期计数为0）
        return [date_counts.get(date, 0) for date in future_dates]


def get_daily_spell_loads_by_source(source, base_date, days_ahead=45):
    """获取指定source未来每日的拼写负荷

    优化：使用单次分组查询代替 45-90 次循环查询
    """
    with get_session() as db:
        # 计算日期范围
        future_dates = [base_date + timedelta(days=i) for i in range(1, days_ahead + 1)]

        # 单次分组查询获取所有日期的计数
        results = (
            db.query(Word.spell_next_review, func.count(Word.id))
            .filter(
                Word.source == source,
                Word.stop_review == 0,
                Word.spell_next_review.in_(future_dates),
            )
            .group_by(Word.spell_next_review)
            .all()
        )

        # 构建日期到计数的映射
        date_counts = {date: count for date, count in results}

        # 按顺序返回每天的负荷（未出现的日期计数为0）
        return [date_counts.get(date, 0) for date in future_dates]
