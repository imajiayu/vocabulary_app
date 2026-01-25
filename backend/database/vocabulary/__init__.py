# -*- coding: utf-8 -*-
"""
Vocabulary DAO 模块
重导出所有函数以保持向后兼容
"""

# Common
from .common import get_current_source

# CRUD
from .word_crud import (
    db_insert_word,
    db_delete_word,
    db_update_word,
    db_update_word_definition_only,
)

# Query
from .word_query import (
    db_fetch_word_info,
    db_get_word_review_info,
    db_get_words_review_info_batch,
    db_fetch_word_info_for_insert_page,
    db_fetch_words_without_definition,
    db_fetch_word_info_paginated,
    db_get_word_elapse_info,
)

# Batch
from .word_batch import (
    db_batch_delete_words,
    db_batch_update_words,
)

# Review
from .word_review import (
    db_fetch_review_word_ids,
    db_fetch_lapse_word_ids,
    db_fetch_spelled_word_ids,
    db_fetch_today_spell,
    db_update_word_for_review,
    db_update_word_for_lapse,
    db_update_word_for_spelling,
    db_get_total_lapse_count,
    adjust_words_for_max_prep_days,
)

# Stats
from .word_stats import (
    db_get_source_statistics,
    db_get_source_stats_from_view,
    db_get_comprehensive_stats,
    get_daily_review_loads_by_source,
    get_daily_spell_loads_by_source,
)

__all__ = [
    # Common
    "get_current_source",
    # CRUD
    "db_insert_word",
    "db_delete_word",
    "db_update_word",
    "db_update_word_definition_only",
    # Query
    "db_fetch_word_info",
    "db_get_word_review_info",
    "db_get_words_review_info_batch",
    "db_fetch_word_info_for_insert_page",
    "db_fetch_words_without_definition",
    "db_fetch_word_info_paginated",
    "db_get_word_elapse_info",
    # Batch
    "db_batch_delete_words",
    "db_batch_update_words",
    # Review
    "db_fetch_review_word_ids",
    "db_fetch_lapse_word_ids",
    "db_fetch_spelled_word_ids",
    "db_fetch_today_spell",
    "db_update_word_for_review",
    "db_update_word_for_lapse",
    "db_update_word_for_spelling",
    "db_get_total_lapse_count",
    "adjust_words_for_max_prep_days",
    # Stats
    "db_get_source_statistics",
    "db_get_source_stats_from_view",
    "db_get_comprehensive_stats",
    "get_daily_review_loads_by_source",
    "get_daily_spell_loads_by_source",
]
