-- get_daily_review_loads: DB 端 GROUP BY 聚合，替代前端传输 10000 行原始数据
-- 使用 auth.uid() 而非参数传入 user_id，RLS 正常生效
CREATE OR REPLACE FUNCTION get_daily_review_loads(
  p_source TEXT, p_days_ahead INT DEFAULT 45
)
RETURNS TABLE(day_offset INT, review_count BIGINT) AS $$
  SELECT
    (next_review - CURRENT_DATE)::INT AS day_offset,
    COUNT(*) AS review_count
  FROM words
  WHERE user_id = auth.uid() AND source = p_source AND stop_review = 0
    AND next_review BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + p_days_ahead
  GROUP BY next_review
  ORDER BY day_offset;
$$ LANGUAGE sql STABLE SECURITY INVOKER;

-- get_daily_spell_loads: 拼写负荷聚合
CREATE OR REPLACE FUNCTION get_daily_spell_loads(
  p_source TEXT, p_days_ahead INT DEFAULT 45
)
RETURNS TABLE(day_offset INT, review_count BIGINT) AS $$
  SELECT
    (spell_next_review - CURRENT_DATE)::INT AS day_offset,
    COUNT(*) AS review_count
  FROM words
  WHERE user_id = auth.uid() AND source = p_source AND stop_review = 0
    AND spell_next_review BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + p_days_ahead
  GROUP BY spell_next_review
  ORDER BY day_offset;
$$ LANGUAGE sql STABLE SECURITY INVOKER;
