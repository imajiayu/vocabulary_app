# -*- coding: utf-8 -*-
"""
统计查询
"""
from datetime import timedelta

from backend.extensions import get_session
from backend.models.word import Word
from .common import get_current_source


def db_get_source_statistics():
    """Get statistics for each source"""
    from backend.config import UserConfig

    with get_session() as db:
        stats = {}

        for source in UserConfig().CUSTOM_SOURCES:
            total = db.query(Word).filter(Word.source == source).count()
            remembered = (
                db.query(Word)
                .filter(Word.source == source, Word.stop_review == 1)
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
        rows = (
            db.query(
                Word.id, Word.word, Word.ease_factor, Word.avg_elapsed_time,
                Word.next_review, Word.remember_count, Word.forget_count,
                Word.spell_strength, Word.spell_next_review, Word.repetition,
                Word.date_added, Word.lapse,
            )
            .filter(Word.source == source, Word.stop_review == 0)
            .all()
        )

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
        }

        date_counter = {}
        max_spell_strength = 5.0

        for row in rows:
            if row.ease_factor is not None:
                stats["ef_data"].append({"word": row.word, "ef": round(row.ease_factor, 2)})

            if row.avg_elapsed_time is not None:
                stats["elapse_times"].append(round(row.avg_elapsed_time))

            if row.next_review is not None:
                stats["next_reviews"].append(row.next_review)

            if row.spell_next_review is not None and (row.repetition >= 3 or row.spell_strength is not None):
                stats["spell_next_reviews"].append(row.spell_next_review)

            review_count = (row.remember_count or 0) + (row.forget_count or 0)
            stats["review_counts"].append(review_count)

            available = (row.repetition or 0) >= 3
            stats["spell_strengths"].append({
                "word": row.word,
                "strength": round(row.spell_strength, 2) if row.spell_strength is not None else None,
                "available": available,
            })

            if row.date_added is not None:
                date_str = row.date_added.isoformat()
                date_counter[date_str] = date_counter.get(date_str, 0) + 1

            if row.lapse is not None:
                stats["total_lapse"] += row.lapse

        # Pre-compute heatmap cells
        for row in rows:
            available = (row.repetition or 0) >= 3
            spell_value = row.spell_strength

            # Spell heatmap cell
            if not available:
                spell_color = "#cbcbcb"
                spell_tooltip = f"{row.word}\n不可拼写"
            elif spell_value is None:
                spell_color = "#4da6ff"
                spell_tooltip = f"{row.word}\n未拼写过"
            else:
                clamped = max(0, min(1, spell_value / max_spell_strength))
                alpha = 0.15 + 0.85 * clamped
                spell_color = f"rgba(46,125,50,{alpha:.3f})"
                spell_tooltip = f"{row.word}\n分数: {spell_value:.1f}"

            stats["spell_heatmap_cells"].append({
                "word": row.word,
                "value": spell_value,
                "available": available,
                "color": spell_color,
                "tooltip": spell_tooltip,
            })

            # EF heatmap cell
            ef_value = row.ease_factor

            if ef_value is None:
                ef_color = "#ffffff"
            elif ef_value <= 1.3:
                ef_color = "#ff4d4f"
            elif ef_value >= 3.0:
                ef_color = "#1890ff"
            elif ef_value == 2.5:
                ef_color = "#ffffff"
            elif ef_value < 2.5:
                t = (ef_value - 1.3) / (2.5 - 1.3)
                r = 255
                g = round(77 + (255 - 77) * t)
                b = round(77 + (255 - 77) * t)
                ef_color = f"rgb({r},{g},{b})"
            else:
                t = (ef_value - 2.5) / (3.0 - 2.5)
                r = round(255 - (255 - 24) * t)
                g = round(255 - (255 - 144) * t)
                b = round(255 - (255 - 255) * t)
                ef_color = f"rgb({r},{g},{b})"

            ef_tooltip = f"{row.word}: {ef_value:.2f}" if ef_value is not None else f"{row.word}: 0.00"

            stats["ef_heatmap_cells"].append({
                "word": row.word,
                "value": ef_value,
                "available": True,
                "color": ef_color,
                "tooltip": ef_tooltip,
            })

        stats["added_dates"] = dict(sorted(date_counter.items()))
        return stats


def get_daily_review_loads_by_source(source, base_date, days_ahead=45):
    """获取指定source未来每日的复习负荷"""
    with get_session() as db:
        loads = []
        for i in range(1, days_ahead + 1):
            future_date = base_date + timedelta(days=i)
            count = (
                db.query(Word.id)
                .filter(
                    Word.source == source,
                    Word.stop_review == 0,
                    Word.next_review == future_date,
                )
                .count()
            )
            loads.append(count)

    return loads


def get_daily_spell_loads_by_source(source, base_date, days_ahead=45):
    """获取指定source未来每日的拼写负荷"""
    with get_session() as db:
        loads = []
        for i in range(1, days_ahead + 1):
            future_date = base_date + timedelta(days=i)
            count = (
                db.query(Word.id)
                .filter(
                    Word.source == source,
                    Word.stop_review == 0,
                    Word.spell_next_review == future_date,
                )
                .count()
            )
            loads.append(count)

    return loads
