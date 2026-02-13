-- 1. 新增列
ALTER TABLE words ADD COLUMN stop_spell INTEGER DEFAULT 0;

-- 2. 更新视图：stats_spell_next_review_distribution
CREATE OR REPLACE VIEW stats_spell_next_review_distribution AS
SELECT user_id, source, spell_next_review AS date, COUNT(*) AS count
FROM words
WHERE stop_spell = 0 AND spell_next_review IS NOT NULL
GROUP BY user_id, source, spell_next_review
ORDER BY user_id, source, spell_next_review;

-- 3. 更新视图：word_source_stats（spelling 相关计数用 stop_spell）
CREATE OR REPLACE VIEW word_source_stats AS
SELECT user_id, source,
  count(*) AS total,
  count(*) FILTER (WHERE stop_review = 1) AS remembered,
  count(*) FILTER (WHERE stop_review = 0) AS unremembered,
  count(*) FILTER (WHERE stop_review = 0 AND next_review IS NOT NULL AND next_review <= CURRENT_DATE) AS due_count,
  count(*) FILTER (WHERE stop_review = 0 AND lapse > 0) AS lapse_count,
  count(*) FILTER (WHERE stop_spell = 0 AND (repetition >= 3 OR spell_strength IS NOT NULL)) AS spelling_count,
  count(*) FILTER (WHERE stop_spell = 0 AND (repetition >= 3 OR spell_strength IS NOT NULL)
    AND (spell_next_review IS NULL OR spell_next_review <= CURRENT_DATE)) AS today_spell_count
FROM words GROUP BY user_id, source;

-- 4. 更新视图：stats_words_raw（去掉 WHERE 过滤，暴露 stop_review/stop_spell 列，前端按用途分别过滤）
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
    COALESCE(forget_count, 0) AS forget_count,
    COALESCE(stop_review, 0) AS stop_review,
    COALESCE(stop_spell, 0) AS stop_spell
FROM words;

-- 5. 更新函数：get_daily_spell_loads
CREATE OR REPLACE FUNCTION get_daily_spell_loads(
  p_source TEXT, p_days_ahead INT DEFAULT 45
) RETURNS TABLE(day_offset INT, review_count BIGINT) AS $$
  SELECT (spell_next_review - CURRENT_DATE)::INT AS day_offset, COUNT(*) AS review_count
  FROM words
  WHERE user_id = auth.uid() AND source = p_source AND stop_spell = 0
    AND spell_next_review BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + p_days_ahead
  GROUP BY spell_next_review ORDER BY day_offset;
$$ LANGUAGE sql STABLE SECURITY INVOKER;
