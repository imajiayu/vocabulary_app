-- Unify stats views to UTC timezone (previously Asia/Shanghai)
-- This aligns with the rest of the system where all dates use UTC.

CREATE OR REPLACE VIEW stats_daily_activity AS
SELECT
    user_id,
    source,
    (reviewed_at AT TIME ZONE 'UTC')::date AS date,
    COUNT(*) AS total_reviews,
    COUNT(*) FILTER (WHERE remembered) AS correct,
    COUNT(*) FILTER (WHERE NOT remembered) AS incorrect,
    COUNT(*) FILTER (WHERE mode = 'review') AS review_mode_count,
    COUNT(*) FILTER (WHERE mode = 'spelling') AS spelling_mode_count
FROM review_history
GROUP BY user_id, source, (reviewed_at AT TIME ZONE 'UTC')::date;

CREATE OR REPLACE VIEW stats_hourly_distribution AS
SELECT
    user_id,
    source,
    EXTRACT(HOUR FROM reviewed_at AT TIME ZONE 'UTC')::integer AS hour,
    COUNT(*) AS count
FROM review_history
GROUP BY user_id, source, EXTRACT(HOUR FROM reviewed_at AT TIME ZONE 'UTC')::integer;
