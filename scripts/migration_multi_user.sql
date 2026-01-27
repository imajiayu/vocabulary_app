-- =============================================
-- Multi-user Migration Script
-- Execute in Supabase SQL Editor
-- IMPORTANT: Backup database before running!
-- =============================================

-- 1. words table
ALTER TABLE words ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1;

-- Remove old unique constraints and add new per-user constraint
ALTER TABLE words DROP CONSTRAINT IF EXISTS unique_word;
ALTER TABLE words DROP CONSTRAINT IF EXISTS words_word_source_key;
ALTER TABLE words ADD CONSTRAINT unique_word_per_user UNIQUE(word, user_id, source);

-- Add index for efficient user filtering
CREATE INDEX IF NOT EXISTS idx_words_user_id ON words(user_id);

-- 2. current_progress table
-- Remove single-row constraint, allow one row per user
ALTER TABLE current_progress DROP CONSTRAINT IF EXISTS single_row_constraint;
ALTER TABLE current_progress ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE current_progress ADD CONSTRAINT unique_progress_per_user UNIQUE(user_id);

-- 3. user_config table
ALTER TABLE user_config DROP CONSTRAINT IF EXISTS user_config_single_row;
ALTER TABLE user_config ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_config ADD CONSTRAINT unique_config_per_user UNIQUE(user_id);

-- 4. words_relations table
ALTER TABLE words_relations ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_words_relations_user_id ON words_relations(user_id);

-- 5. relation_generation_log table
ALTER TABLE relation_generation_log ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_relation_generation_log_user_id ON relation_generation_log(user_id);

-- 6. speaking_records table
ALTER TABLE speaking_records ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_speaking_records_user_id ON speaking_records(user_id);

-- =============================================
-- Recreate Views with user_id column
-- NOTE: Must DROP first because CREATE OR REPLACE VIEW
-- cannot change column structure (add/remove/rename columns)
-- =============================================

-- Drop all views first (in reverse dependency order)
DROP VIEW IF EXISTS stats_words_raw CASCADE;
DROP VIEW IF EXISTS stats_next_review_distribution CASCADE;
DROP VIEW IF EXISTS stats_spell_next_review_distribution CASCADE;
DROP VIEW IF EXISTS stats_elapsed_time_distribution CASCADE;
DROP VIEW IF EXISTS stats_review_count_distribution CASCADE;
DROP VIEW IF EXISTS stats_added_date_distribution CASCADE;
DROP VIEW IF EXISTS word_source_stats CASCADE;
DROP VIEW IF EXISTS relation_stats CASCADE;

-- stats_words_raw
CREATE VIEW stats_words_raw AS
SELECT
    user_id,
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
    (COALESCE(repetition, 0) >= 3) as spell_available
FROM words
WHERE stop_review = 0;

-- stats_next_review_distribution
CREATE VIEW stats_next_review_distribution AS
SELECT
    user_id,
    source,
    next_review as date,
    COUNT(*) as count
FROM words
WHERE stop_review = 0 AND next_review IS NOT NULL
GROUP BY user_id, source, next_review
ORDER BY user_id, source, next_review;

-- stats_spell_next_review_distribution
CREATE VIEW stats_spell_next_review_distribution AS
SELECT
    user_id,
    source,
    spell_next_review as date,
    COUNT(*) as count
FROM words
WHERE stop_review = 0
    AND spell_next_review IS NOT NULL
    AND (COALESCE(repetition, 0) >= 3 OR spell_strength IS NOT NULL)
GROUP BY user_id, source, spell_next_review
ORDER BY user_id, source, spell_next_review;

-- stats_elapsed_time_distribution
CREATE VIEW stats_elapsed_time_distribution AS
SELECT
    user_id,
    source,
    ROUND(avg_elapsed_time::numeric) as elapsed_time,
    COUNT(*) as count
FROM words
WHERE stop_review = 0 AND avg_elapsed_time IS NOT NULL
GROUP BY user_id, source, ROUND(avg_elapsed_time::numeric)
ORDER BY user_id, source, elapsed_time;

-- stats_review_count_distribution
CREATE VIEW stats_review_count_distribution AS
SELECT
    user_id,
    source,
    (COALESCE(remember_count, 0) + COALESCE(forget_count, 0)) as review_count,
    COUNT(*) as count
FROM words
WHERE stop_review = 0
GROUP BY user_id, source, (COALESCE(remember_count, 0) + COALESCE(forget_count, 0))
ORDER BY user_id, source, review_count;

-- stats_added_date_distribution
CREATE VIEW stats_added_date_distribution AS
SELECT
    user_id,
    source,
    date_added as date,
    COUNT(*) as count
FROM words
WHERE stop_review = 0 AND date_added IS NOT NULL
GROUP BY user_id, source, date_added
ORDER BY user_id, source, date_added;

-- word_source_stats (main statistics view)
CREATE VIEW word_source_stats AS
SELECT
    user_id,
    source,
    count(*) AS total,
    count(*) FILTER (WHERE stop_review = 1) AS remembered,
    count(*) FILTER (WHERE stop_review = 0) AS unremembered,
    count(*) FILTER (WHERE stop_review = 0 AND next_review IS NOT NULL AND next_review <= CURRENT_DATE) AS due_count,
    count(*) FILTER (WHERE stop_review = 0 AND lapse > 0) AS lapse_count,
    count(*) FILTER (WHERE stop_review = 0 AND (repetition >= 3 OR spell_strength IS NOT NULL)) AS spelling_count,
    count(*) FILTER (WHERE stop_review = 0 AND (repetition >= 3 OR spell_strength IS NOT NULL) AND (spell_next_review IS NULL OR spell_next_review <= CURRENT_DATE)) AS today_spell_count
FROM words
GROUP BY user_id, source;

-- relation_stats (relation type statistics)
CREATE VIEW relation_stats AS
SELECT
    user_id,
    relation_type,
    count(*) / 2 AS count
FROM words_relations
GROUP BY user_id, relation_type;

-- =============================================
-- Migration Complete!
-- All existing data is now assigned to user_id=1
-- =============================================
