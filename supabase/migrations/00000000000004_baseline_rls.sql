-- =============================================
-- Baseline Part 4: Row Level Security (RLS)
-- =============================================
-- RLS enabled on all 12 tables

-- =========================
-- Enable RLS
-- =========================

ALTER TABLE words ENABLE ROW LEVEL SECURITY;
ALTER TABLE words_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE relation_generation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE speaking_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE speaking_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE speaking_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE writing_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE writing_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE writing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_history ENABLE ROW LEVEL SECURITY;

-- =========================
-- Policies: words
-- =========================

CREATE POLICY "select_own" ON words FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON words FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON words FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own" ON words FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- Policies: words_relations
-- =========================

CREATE POLICY "select_own" ON words_relations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON words_relations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON words_relations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own" ON words_relations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- Policies: current_progress
-- =========================

CREATE POLICY "select_own" ON current_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON current_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON current_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own" ON current_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- Policies: user_config
-- =========================

CREATE POLICY "select_own" ON user_config FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON user_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON user_config FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own" ON user_config FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- Policies: relation_generation_log
-- =========================

CREATE POLICY "select_own" ON relation_generation_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON relation_generation_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON relation_generation_log FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own" ON relation_generation_log FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- Policies: speaking_topics
-- =========================

CREATE POLICY "select_own" ON speaking_topics FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON speaking_topics FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON speaking_topics FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own" ON speaking_topics FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- Policies: speaking_questions
-- =========================

CREATE POLICY "select_own" ON speaking_questions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON speaking_questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON speaking_questions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own" ON speaking_questions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- Policies: speaking_records
-- =========================

CREATE POLICY "select_own" ON speaking_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON speaking_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON speaking_records FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own" ON speaking_records FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- Policies: writing_folders
-- =========================

CREATE POLICY "select_own" ON writing_folders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON writing_folders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON writing_folders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own" ON writing_folders FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- Policies: writing_prompts
-- =========================

CREATE POLICY "select_own" ON writing_prompts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON writing_prompts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON writing_prompts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own" ON writing_prompts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- Policies: writing_sessions
-- =========================

CREATE POLICY "select_own" ON writing_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON writing_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON writing_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own" ON writing_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- Policies: review_history (SELECT + INSERT only)
-- =========================

CREATE POLICY "Users can read own review history" ON review_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own review history" ON review_history FOR INSERT WITH CHECK (auth.uid() = user_id);
