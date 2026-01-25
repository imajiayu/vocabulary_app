-- Migration: Statistics Views for Direct Supabase Access
-- Date: 2026-01-25
-- Purpose: Replace Flask /api/stats endpoint with Supabase views
--          Frontend will call these views directly via Supabase client

-- =============================================
-- View: stats_words_raw
-- Purpose: Raw word data for statistics (EF, spell strength, heatmaps)
-- Usage: select * from stats_words_raw where source = 'IELTS'
-- Note: 前端使用 repetition 计算 available，避免跨数据库布尔类型问题
-- =============================================
CREATE OR REPLACE VIEW stats_words_raw AS
SELECT
    id,
    word,
    source,
    ease_factor,
    ROUND(ease_factor::numeric, 2) as ef_rounded,
    ROUND(avg_elapsed_time::numeric) as elapsed_time_rounded,
    next_review,
    spell_next_review,
    (COALESCE(remember_count, 0) + COALESCE(forget_count, 0)) as review_count,
    spell_strength,
    ROUND(spell_strength::numeric, 2) as spell_strength_rounded,
    COALESCE(repetition, 0) as repetition,
    date_added,
    -- Spell availability: repetition >= 3 (布尔值，前端也会用 repetition 重新计算)
    (COALESCE(repetition, 0) >= 3) as spell_available
FROM words
WHERE stop_review = 0;

-- =============================================
-- View: stats_next_review_distribution
-- Purpose: Count of words due for review by date
-- Usage: select * from stats_next_review_distribution where source = 'IELTS'
-- =============================================
CREATE OR REPLACE VIEW stats_next_review_distribution AS
SELECT
    source,
    next_review as date,
    COUNT(*) as count
FROM words
WHERE stop_review = 0 AND next_review IS NOT NULL
GROUP BY source, next_review
ORDER BY source, next_review;

-- =============================================
-- View: stats_spell_next_review_distribution
-- Purpose: Count of words due for spelling by date
-- Usage: select * from stats_spell_next_review_distribution where source = 'IELTS'
-- =============================================
CREATE OR REPLACE VIEW stats_spell_next_review_distribution AS
SELECT
    source,
    spell_next_review as date,
    COUNT(*) as count
FROM words
WHERE stop_review = 0
    AND spell_next_review IS NOT NULL
    AND (COALESCE(repetition, 0) >= 3 OR spell_strength IS NOT NULL)
GROUP BY source, spell_next_review
ORDER BY source, spell_next_review;

-- =============================================
-- View: stats_elapsed_time_distribution
-- Purpose: Count of words by rounded elapsed time (seconds)
-- Usage: select * from stats_elapsed_time_distribution where source = 'IELTS'
-- =============================================
CREATE OR REPLACE VIEW stats_elapsed_time_distribution AS
SELECT
    source,
    ROUND(avg_elapsed_time::numeric) as elapsed_time,
    COUNT(*) as count
FROM words
WHERE stop_review = 0 AND avg_elapsed_time IS NOT NULL
GROUP BY source, ROUND(avg_elapsed_time::numeric)
ORDER BY source, elapsed_time;

-- =============================================
-- View: stats_review_count_distribution
-- Purpose: Count of words by total review count
-- Usage: select * from stats_review_count_distribution where source = 'IELTS'
-- =============================================
CREATE OR REPLACE VIEW stats_review_count_distribution AS
SELECT
    source,
    (COALESCE(remember_count, 0) + COALESCE(forget_count, 0)) as review_count,
    COUNT(*) as count
FROM words
WHERE stop_review = 0
GROUP BY source, (COALESCE(remember_count, 0) + COALESCE(forget_count, 0))
ORDER BY source, review_count;

-- =============================================
-- View: stats_added_date_distribution
-- Purpose: Count of words by date added
-- Usage: select * from stats_added_date_distribution where source = 'IELTS'
-- =============================================
CREATE OR REPLACE VIEW stats_added_date_distribution AS
SELECT
    source,
    date_added as date,
    COUNT(*) as count
FROM words
WHERE stop_review = 0 AND date_added IS NOT NULL
GROUP BY source, date_added
ORDER BY source, date_added;

-- =============================================
-- Grant permissions for anonymous access (if needed)
-- =============================================
-- Note: Run these in Supabase SQL Editor if RLS is enabled
-- GRANT SELECT ON stats_words_raw TO anon;
-- GRANT SELECT ON stats_next_review_distribution TO anon;
-- GRANT SELECT ON stats_spell_next_review_distribution TO anon;
-- GRANT SELECT ON stats_elapsed_time_distribution TO anon;
-- GRANT SELECT ON stats_review_count_distribution TO anon;
-- GRANT SELECT ON stats_added_date_distribution TO anon;
