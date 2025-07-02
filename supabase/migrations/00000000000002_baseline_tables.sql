-- =============================================
-- Baseline Part 2: Tables, Indexes & Triggers
-- =============================================
-- 12 tables total

-- =========================
-- words
-- =========================

CREATE TABLE IF NOT EXISTS words (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    word VARCHAR NOT NULL,
    definition VARCHAR,
    date_added DATE,
    remember_count INTEGER,
    forget_count INTEGER,
    last_remembered DATE,
    last_forgot DATE,
    stop_review INTEGER,
    next_review DATE,
    interval INTEGER,
    repetition INTEGER,
    ease_factor DOUBLE PRECISION,
    last_score INTEGER,
    avg_elapsed_time INTEGER,
    lapse INTEGER,
    spell_strength DOUBLE PRECISION,
    spell_next_review DATE,
    source VARCHAR(20) NOT NULL,
    CONSTRAINT unique_word_per_user UNIQUE (word, user_id, source)
);

CREATE INDEX IF NOT EXISTS idx_words_user_id ON words (user_id);

-- =========================
-- words_relations
-- =========================

CREATE TABLE IF NOT EXISTS words_relations (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    related_word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    relation_type relation_type_enum NOT NULL,
    confidence DOUBLE PRECISION,
    CONSTRAINT uq_word_relation_type UNIQUE (word_id, related_word_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_words_relations_user_id ON words_relations (user_id);

-- =========================
-- current_progress
-- =========================

CREATE TABLE IF NOT EXISTS current_progress (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mode VARCHAR(20),
    source VARCHAR(10),
    shuffle BOOLEAN,
    word_ids_snapshot TEXT,
    current_index INTEGER,
    initial_lapse_count INTEGER,
    initial_lapse_word_count INTEGER,
    CONSTRAINT unique_progress_per_user UNIQUE (user_id)
);

-- =========================
-- user_config
-- =========================

CREATE TABLE IF NOT EXISTS user_config (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    config JSONB,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_config_per_user UNIQUE (user_id)
);

CREATE TRIGGER trg_user_config_updated_at
    BEFORE UPDATE ON user_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =========================
-- relation_generation_log
-- =========================

CREATE TABLE IF NOT EXISTS relation_generation_log (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    relation_type relation_type_enum NOT NULL,
    processed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    found_count INTEGER,
    CONSTRAINT uq_word_relation_log UNIQUE (word_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_relation_generation_log_user_id ON relation_generation_log (user_id);

-- =========================
-- speaking_topics
-- =========================

CREATE TABLE IF NOT EXISTS speaking_topics (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    part INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    CONSTRAINT speaking_topics_user_part_title_key UNIQUE (user_id, part, title)
);

CREATE INDEX IF NOT EXISTS idx_speaking_topics_user ON speaking_topics (user_id);

-- =========================
-- speaking_questions
-- =========================

CREATE TABLE IF NOT EXISTS speaking_questions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id INTEGER NOT NULL REFERENCES speaking_topics(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_speaking_questions_user ON speaking_questions (user_id);

-- =========================
-- speaking_records
-- =========================

CREATE TABLE IF NOT EXISTS speaking_records (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES speaking_questions(id) ON DELETE CASCADE,
    user_answer TEXT,
    audio_file VARCHAR(255),
    ai_feedback TEXT,
    score NUMERIC(3,1),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_speaking_records_user_id ON speaking_records (user_id);

-- =========================
-- writing_folders
-- =========================

CREATE TABLE IF NOT EXISTS writing_folders (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT writing_folders_user_id_name_key UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_writing_folders_user ON writing_folders (user_id);

-- =========================
-- writing_prompts
-- =========================

CREATE TABLE IF NOT EXISTS writing_prompts (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    folder_id INTEGER REFERENCES writing_folders(id) ON DELETE SET NULL,
    task_type INTEGER NOT NULL,
    prompt_text TEXT NOT NULL,
    image_url TEXT,
    notes TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT writing_prompts_task_type_check CHECK (task_type = ANY (ARRAY[1, 2]))
);

CREATE INDEX IF NOT EXISTS idx_writing_prompts_user ON writing_prompts (user_id);
CREATE INDEX IF NOT EXISTS idx_writing_prompts_folder ON writing_prompts (user_id, folder_id);

-- =========================
-- writing_sessions
-- =========================

CREATE TABLE IF NOT EXISTS writing_sessions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    prompt_id INTEGER REFERENCES writing_prompts(id) ON DELETE SET NULL,
    time_limit INTEGER NOT NULL,
    time_spent INTEGER,
    status VARCHAR(20) DEFAULT 'writing',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    outline TEXT,
    draft_content TEXT,
    final_content TEXT,
    feedback JSONB,
    scores JSONB,
    word_count INTEGER,
    CONSTRAINT writing_sessions_status_check CHECK (
        status::text = ANY (ARRAY['outline', 'writing', 'feedback', 'revision', 'completed']::text[])
    )
);

CREATE INDEX IF NOT EXISTS idx_writing_sessions_user ON writing_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_writing_sessions_status ON writing_sessions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_writing_sessions_prompt ON writing_sessions (prompt_id);

-- =========================
-- review_history
-- =========================

CREATE TABLE IF NOT EXISTS review_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    score INTEGER CHECK (score >= 1 AND score <= 5),
    remembered BOOLEAN NOT NULL,
    elapsed_time INTEGER,
    mode VARCHAR(10) NOT NULL CHECK (mode IN ('review', 'spelling')),
    source VARCHAR(20) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_history_user_date ON review_history (user_id, reviewed_at);
