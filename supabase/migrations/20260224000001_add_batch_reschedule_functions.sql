-- batch_reschedule_review: 批量更新复习日期（UNNEST 对齐数组，单次 SQL）
-- 只修改 next_review，不触碰 SM-2 参数（ease_factor, interval, repetition, lapse）
CREATE OR REPLACE FUNCTION batch_reschedule_review(
  p_word_ids INT[], p_dates DATE[]
)
RETURNS VOID AS $$
  UPDATE words w
  SET next_review = u.new_date
  FROM UNNEST(p_word_ids, p_dates) AS u(wid, new_date)
  WHERE w.id = u.wid AND w.user_id = auth.uid();
$$ LANGUAGE sql VOLATILE SECURITY INVOKER;

-- batch_reschedule_spell: 批量更新拼写日期（同理）
-- 只修改 spell_next_review，不触碰 spell_strength
CREATE OR REPLACE FUNCTION batch_reschedule_spell(
  p_word_ids INT[], p_dates DATE[]
)
RETURNS VOID AS $$
  UPDATE words w
  SET spell_next_review = u.new_date
  FROM UNNEST(p_word_ids, p_dates) AS u(wid, new_date)
  WHERE w.id = u.wid AND w.user_id = auth.uid();
$$ LANGUAGE sql VOLATILE SECURITY INVOKER;
