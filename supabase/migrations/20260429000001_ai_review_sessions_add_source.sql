-- AI 复习按 source 隔离:为 ai_review_sessions 加 source 列
-- 替换原 UNIQUE(user_id, date) 为 UNIQUE(user_id, date, source)
--
-- 已存在的 session 是跨 source 混合内容(questions 字段引用了多 source 的词),
-- 仅靠加标签无法修复,直接清空,用户首次访问 AI 复习页时按 source 重新生成。

TRUNCATE TABLE ai_review_sessions;

ALTER TABLE ai_review_sessions ADD COLUMN source VARCHAR(20) NOT NULL;

-- 动态找出原 (user_id, date) UNIQUE 约束名并 DROP（避免依赖 PG 自动命名）
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'ai_review_sessions'::regclass
    AND contype = 'u'
    AND conkey @> ARRAY[
      (SELECT attnum FROM pg_attribute WHERE attrelid = 'ai_review_sessions'::regclass AND attname = 'user_id'),
      (SELECT attnum FROM pg_attribute WHERE attrelid = 'ai_review_sessions'::regclass AND attname = 'date')
    ]
    AND array_length(conkey, 1) = 2;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE ai_review_sessions DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE ai_review_sessions ADD CONSTRAINT ai_review_sessions_user_date_source_key
  UNIQUE (user_id, date, source);

DROP INDEX IF EXISTS idx_ai_review_sessions_user_date;
CREATE INDEX idx_ai_review_sessions_user_source_date
  ON ai_review_sessions (user_id, source, date DESC);
