-- AI 复习会话：按 UTC 日期聚合当天 review_history 生成的翻译练习
CREATE TABLE ai_review_sessions (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  word_ids integer[] NOT NULL,
  questions jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX idx_ai_review_sessions_user_date
  ON ai_review_sessions (user_id, date DESC);

CREATE TRIGGER trg_ai_review_sessions_updated_at
  BEFORE UPDATE ON ai_review_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE ai_review_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_ai_review_sessions" ON ai_review_sessions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
