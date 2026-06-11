-- 修复 stats_words_raw 视图的 spell_available 口径
-- 原定义只看 repetition >= 3，与真实拼写队列取词逻辑（words.ts:
-- repetition.gte.3,spell_strength.not.is.null）及 word_source_stats 计数口径不一致。
-- 导致"拼过又在复习中忘记（repetition 掉回 < 3）"的词在拼写热力图中被错误标为"不可拼写"。
-- 正确规则：repetition >= 3 OR spell_strength IS NOT NULL。

CREATE OR REPLACE VIEW stats_words_raw AS
SELECT
    user_id, id, word, source, ease_factor,
    ROUND(ease_factor::numeric, 2) AS ef_rounded,
    ROUND(avg_elapsed_time::numeric) AS elapsed_time_rounded,
    next_review, spell_next_review,
    (COALESCE(remember_count, 0) + COALESCE(forget_count, 0)) AS review_count,
    spell_strength,
    ROUND(spell_strength::numeric, 2) AS spell_strength_rounded,
    COALESCE(repetition, 0) AS repetition,
    date_added,
    (COALESCE(repetition, 0) >= 3 OR spell_strength IS NOT NULL) AS spell_available,
    interval,
    last_score,
    COALESCE(lapse, 0) AS lapse,
    COALESCE(remember_count, 0) AS remember_count,
    COALESCE(forget_count, 0) AS forget_count,
    COALESCE(stop_review, 0) AS stop_review,
    COALESCE(stop_spell, 0) AS stop_spell
FROM words;
