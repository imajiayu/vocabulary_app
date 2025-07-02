-- =============================================
-- Baseline Part 3: Views
-- =============================================
-- 13 views total

-- =========================
-- stats_words_raw
-- =========================

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
    (COALESCE(repetition, 0) >= 3) AS spell_available,
    interval,
    last_score,
    COALESCE(lapse, 0) AS lapse,
    COALESCE(remember_count, 0) AS remember_count,
    COALESCE(forget_count, 0) AS forget_count
FROM words WHERE stop_review = 0;

-- =========================
-- stats_next_review_distribution
-- =========================

CREATE OR REPLACE VIEW stats_next_review_distribution AS
SELECT
    user_id,
    source,
    next_review AS date,
    COUNT(*) AS count
FROM words
WHERE stop_review = 0 AND next_review IS NOT NULL
GROUP BY user_id, source, next_review
ORDER BY user_id, source, next_review;

-- =========================
-- stats_spell_next_review_distribution
-- =========================

CREATE OR REPLACE VIEW stats_spell_next_review_distribution AS
SELECT
    user_id,
    source,
    spell_next_review AS date,
    COUNT(*) AS count
FROM words
WHERE stop_review = 0 AND spell_next_review IS NOT NULL
GROUP BY user_id, source, spell_next_review
ORDER BY user_id, source, spell_next_review;

-- =========================
-- stats_elapsed_time_distribution
-- =========================

CREATE OR REPLACE VIEW stats_elapsed_time_distribution AS
SELECT
    user_id,
    source,
    ROUND(avg_elapsed_time::numeric) AS elapsed_time,
    COUNT(*) AS count
FROM words
WHERE stop_review = 0 AND avg_elapsed_time IS NOT NULL
GROUP BY user_id, source, ROUND(avg_elapsed_time::numeric)
ORDER BY user_id, source, ROUND(avg_elapsed_time::numeric);

-- =========================
-- stats_review_count_distribution
-- =========================

CREATE OR REPLACE VIEW stats_review_count_distribution AS
SELECT
    user_id,
    source,
    (COALESCE(remember_count, 0) + COALESCE(forget_count, 0)) AS review_count,
    COUNT(*) AS count
FROM words
WHERE stop_review = 0
GROUP BY user_id, source, (COALESCE(remember_count, 0) + COALESCE(forget_count, 0))
ORDER BY user_id, source, (COALESCE(remember_count, 0) + COALESCE(forget_count, 0));

-- =========================
-- stats_added_date_distribution
-- =========================

CREATE OR REPLACE VIEW stats_added_date_distribution AS
SELECT
    user_id,
    source,
    date_added AS date,
    COUNT(*) AS count
FROM words
WHERE stop_review = 0 AND date_added IS NOT NULL
GROUP BY user_id, source, date_added
ORDER BY user_id, source, date_added;

-- =========================
-- stats_lapse_distribution
-- =========================

CREATE OR REPLACE VIEW stats_lapse_distribution AS
SELECT
    user_id,
    source,
    COALESCE(lapse, 0) AS lapse,
    COUNT(*) AS count
FROM words
WHERE stop_review = 0
GROUP BY user_id, source, COALESCE(lapse, 0);

-- =========================
-- stats_interval_distribution
-- =========================

CREATE OR REPLACE VIEW stats_interval_distribution AS
SELECT
    user_id,
    source,
    interval,
    COUNT(*) AS count
FROM words
WHERE stop_review = 0 AND interval IS NOT NULL
GROUP BY user_id, source, interval;

-- =========================
-- stats_mastered_overview
-- =========================

CREATE OR REPLACE VIEW stats_mastered_overview AS
SELECT
    user_id,
    source,
    COUNT(*) AS total_mastered,
    AVG(ease_factor) AS avg_ease_factor,
    AVG(COALESCE(remember_count, 0) + COALESCE(forget_count, 0)) AS avg_review_count,
    AVG(avg_elapsed_time) AS avg_elapsed_time
FROM words
WHERE stop_review = 1
GROUP BY user_id, source;

-- =========================
-- word_source_stats
-- =========================

CREATE OR REPLACE VIEW word_source_stats AS
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

-- =========================
-- relation_stats
-- =========================

CREATE OR REPLACE VIEW relation_stats AS
SELECT
    user_id,
    relation_type,
    count(*) / 2 AS count
FROM words_relations
GROUP BY user_id, relation_type;

-- =========================
-- stats_daily_activity (from review_history)
-- =========================

CREATE OR REPLACE VIEW stats_daily_activity AS
SELECT
    user_id,
    source,
    (reviewed_at AT TIME ZONE 'Asia/Shanghai')::date AS date,
    COUNT(*) AS total_reviews,
    COUNT(*) FILTER (WHERE remembered) AS correct,
    COUNT(*) FILTER (WHERE NOT remembered) AS incorrect,
    COUNT(*) FILTER (WHERE mode = 'review') AS review_mode_count,
    COUNT(*) FILTER (WHERE mode = 'spelling') AS spelling_mode_count
FROM review_history
GROUP BY user_id, source, (reviewed_at AT TIME ZONE 'Asia/Shanghai')::date;

-- =========================
-- stats_hourly_distribution (from review_history)
-- =========================

CREATE OR REPLACE VIEW stats_hourly_distribution AS
SELECT
    user_id,
    source,
    EXTRACT(HOUR FROM reviewed_at AT TIME ZONE 'Asia/Shanghai')::integer AS hour,
    COUNT(*) AS count
FROM review_history
GROUP BY user_id, source, EXTRACT(HOUR FROM reviewed_at AT TIME ZONE 'Asia/Shanghai')::integer;
