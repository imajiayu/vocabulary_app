-- delete_words_cascade: 事务化级联删除单词及其关联数据
-- 替代前端 3 次串行 DELETE，提供事务保护
-- 使用 auth.uid() 而非参数传入 user_id，避免 SECURITY DEFINER 绕过 RLS
CREATE OR REPLACE FUNCTION delete_words_cascade(p_word_ids INT[])
RETURNS void AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  DELETE FROM words_relations
    WHERE user_id = v_user_id
      AND (word_id = ANY(p_word_ids) OR related_word_id = ANY(p_word_ids));

  DELETE FROM relation_generation_log
    WHERE user_id = v_user_id
      AND word_id = ANY(p_word_ids);

  DELETE FROM words
    WHERE user_id = v_user_id
      AND id = ANY(p_word_ids);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
