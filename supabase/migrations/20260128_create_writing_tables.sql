-- ============================================================================
-- IELTS 写作练习模块 - 数据库迁移
-- 注意：此项目使用简单的 INTEGER user_id (1, 2)，不使用 Supabase Auth
-- ============================================================================

-- 删除旧表（注意顺序，先删除有外键依赖的表）
DROP TABLE IF EXISTS writing_versions CASCADE;
DROP TABLE IF EXISTS writing_sessions CASCADE;
DROP TABLE IF EXISTS writing_prompts CASCADE;
DROP TABLE IF EXISTS writing_folders CASCADE;

-- ============================================================================
-- 1. writing_folders - 文件夹表
-- ============================================================================

CREATE TABLE writing_folders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL DEFAULT 1,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_writing_folders_user ON writing_folders(user_id);

ALTER TABLE writing_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own folders" ON writing_folders FOR SELECT
  USING (user_id = COALESCE(current_setting('request.headers', true)::json->>'x-user-id', '1')::integer);

CREATE POLICY "Users can create own folders" ON writing_folders FOR INSERT
  WITH CHECK (user_id = COALESCE(current_setting('request.headers', true)::json->>'x-user-id', '1')::integer);

CREATE POLICY "Users can update own folders" ON writing_folders FOR UPDATE
  USING (user_id = COALESCE(current_setting('request.headers', true)::json->>'x-user-id', '1')::integer);

CREATE POLICY "Users can delete own folders" ON writing_folders FOR DELETE
  USING (user_id = COALESCE(current_setting('request.headers', true)::json->>'x-user-id', '1')::integer);

-- ============================================================================
-- 2. writing_prompts - 题目表
-- ============================================================================

CREATE TABLE writing_prompts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL DEFAULT 1,
  folder_id INTEGER REFERENCES writing_folders(id) ON DELETE SET NULL,
  task_type INTEGER NOT NULL CHECK (task_type IN (1, 2)),
  prompt_text TEXT NOT NULL,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_writing_prompts_user ON writing_prompts(user_id);
CREATE INDEX idx_writing_prompts_folder ON writing_prompts(user_id, folder_id);

ALTER TABLE writing_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prompts" ON writing_prompts FOR SELECT
  USING (user_id = COALESCE(current_setting('request.headers', true)::json->>'x-user-id', '1')::integer);

CREATE POLICY "Users can create own prompts" ON writing_prompts FOR INSERT
  WITH CHECK (user_id = COALESCE(current_setting('request.headers', true)::json->>'x-user-id', '1')::integer);

CREATE POLICY "Users can update own prompts" ON writing_prompts FOR UPDATE
  USING (user_id = COALESCE(current_setting('request.headers', true)::json->>'x-user-id', '1')::integer);

CREATE POLICY "Users can delete own prompts" ON writing_prompts FOR DELETE
  USING (user_id = COALESCE(current_setting('request.headers', true)::json->>'x-user-id', '1')::integer);

-- ============================================================================
-- 3. writing_sessions - 练习会话表
-- ============================================================================

CREATE TABLE writing_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL DEFAULT 1,
  prompt_id INTEGER REFERENCES writing_prompts(id) ON DELETE SET NULL,
  time_limit INTEGER NOT NULL,
  time_spent INTEGER,
  status VARCHAR(20) DEFAULT 'writing' CHECK (status IN ('writing', 'revision', 'completed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_writing_sessions_user ON writing_sessions(user_id);
CREATE INDEX idx_writing_sessions_prompt ON writing_sessions(prompt_id);
CREATE INDEX idx_writing_sessions_status ON writing_sessions(user_id, status);

ALTER TABLE writing_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON writing_sessions FOR SELECT
  USING (user_id = COALESCE(current_setting('request.headers', true)::json->>'x-user-id', '1')::integer);

CREATE POLICY "Users can create own sessions" ON writing_sessions FOR INSERT
  WITH CHECK (user_id = COALESCE(current_setting('request.headers', true)::json->>'x-user-id', '1')::integer);

CREATE POLICY "Users can update own sessions" ON writing_sessions FOR UPDATE
  USING (user_id = COALESCE(current_setting('request.headers', true)::json->>'x-user-id', '1')::integer);

CREATE POLICY "Users can delete own sessions" ON writing_sessions FOR DELETE
  USING (user_id = COALESCE(current_setting('request.headers', true)::json->>'x-user-id', '1')::integer);

-- ============================================================================
-- 4. writing_versions - 作文版本表
-- ============================================================================

CREATE TABLE writing_versions (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES writing_sessions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number IN (1, 2, 3)),
  content TEXT NOT NULL,
  word_count INTEGER,
  feedback JSONB,
  scores JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, version_number)
);

CREATE INDEX idx_writing_versions_session ON writing_versions(session_id);

ALTER TABLE writing_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own versions" ON writing_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM writing_sessions s
    WHERE s.id = writing_versions.session_id
    AND s.user_id = COALESCE(current_setting('request.headers', true)::json->>'x-user-id', '1')::integer
  ));

CREATE POLICY "Users can create own versions" ON writing_versions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM writing_sessions s
    WHERE s.id = session_id
    AND s.user_id = COALESCE(current_setting('request.headers', true)::json->>'x-user-id', '1')::integer
  ));

CREATE POLICY "Users can update own versions" ON writing_versions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM writing_sessions s
    WHERE s.id = writing_versions.session_id
    AND s.user_id = COALESCE(current_setting('request.headers', true)::json->>'x-user-id', '1')::integer
  ));

CREATE POLICY "Users can delete own versions" ON writing_versions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM writing_sessions s
    WHERE s.id = writing_versions.session_id
    AND s.user_id = COALESCE(current_setting('request.headers', true)::json->>'x-user-id', '1')::integer
  ));

-- ============================================================================
-- Storage Bucket: writing-images (如果需要的话在 Dashboard 手动创建)
-- ============================================================================
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('writing-images', 'writing-images', true)
-- ON CONFLICT (id) DO NOTHING;
