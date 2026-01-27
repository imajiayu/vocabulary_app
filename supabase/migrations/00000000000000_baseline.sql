-- =============================================
-- Baseline Migration: IELTS Vocabulary App
-- =============================================
-- This is the authoritative schema definition.
-- All previous migrations have been consolidated here.
--
-- To apply to a fresh Supabase project:
--   1. Run this migration in Supabase SQL Editor
--   2. Create storage bucket 'speaking-audios' manually
--   3. Deploy Edge Functions from /supabase/functions/
-- =============================================

-- =============================================
-- Enum Types
-- =============================================

DO $$ BEGIN
    CREATE TYPE relation_type_enum AS ENUM ('synonym', 'antonym', 'root', 'confused', 'topic');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- Table: words
-- Core vocabulary with SM-2 spaced repetition
-- =============================================

CREATE TABLE IF NOT EXISTS words (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    word VARCHAR NOT NULL,
    definition TEXT,
    date_added DATE DEFAULT CURRENT_DATE,
    remember_count INTEGER DEFAULT 0,
    forget_count INTEGER DEFAULT 0,
    last_remembered DATE,
    last_forgot DATE,
    stop_review INTEGER DEFAULT 0,
    next_review DATE,
    interval INTEGER DEFAULT 1,
    repetition INTEGER DEFAULT 0,
    ease_factor FLOAT DEFAULT 2.5,
    last_score INTEGER DEFAULT 0,
    avg_elapsed_time INTEGER DEFAULT 0,
    lapse INTEGER DEFAULT 0,
    spell_strength FLOAT,
    spell_next_review DATE,
    source VARCHAR(20) NOT NULL,
    CONSTRAINT unique_word_per_user UNIQUE(word, user_id, source)
);

CREATE INDEX IF NOT EXISTS idx_words_user_id ON words(user_id);

-- =============================================
-- Table: words_relations
-- Bidirectional word relationships
-- =============================================

CREATE TABLE IF NOT EXISTS words_relations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    related_word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    relation_type relation_type_enum NOT NULL,
    confidence FLOAT DEFAULT 1.0,
    CONSTRAINT uq_word_relation_type UNIQUE(word_id, related_word_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_words_relations_user_id ON words_relations(user_id);

-- =============================================
-- Table: current_progress
-- Learning session progress (one row per user)
-- =============================================

CREATE TABLE IF NOT EXISTS current_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    source VARCHAR(20),
    CONSTRAINT unique_progress_per_user UNIQUE(user_id)
);

-- =============================================
-- Table: user_config
-- User configuration as JSON (one row per user)
-- =============================================

CREATE TABLE IF NOT EXISTS user_config (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    config JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_config_per_user UNIQUE(user_id)
);

-- Insert default config for user_id=1 if not exists
INSERT INTO user_config (user_id, config)
SELECT 1, '{
  "learning": {
    "dailyReviewLimit": 300,
    "dailySpellLimit": 200,
    "maxPrepDays": 30,
    "lapseQueueSize": 25,
    "lapseMaxValue": 4,
    "lapseInitialValue": 3,
    "lapseFastExitEnabled": true,
    "lapseConsecutiveThreshold": 4,
    "defaultShuffle": true,
    "lowEfExtraCount": 0
  },
  "management": {
    "wordsLoadBatchSize": 200,
    "definitionFetchThreads": 3
  },
  "sources": {
    "customSources": ["IELTS", "GRE"]
  },
  "audio": {
    "accent": "us",
    "autoPlayOnWordChange": true,
    "autoPlayAfterAnswer": true
  },
  "hotkeys": {
    "reviewInitial": {
      "remembered": "ArrowLeft",
      "notRemembered": "ArrowRight",
      "stopReview": "ArrowDown"
    },
    "reviewAfter": {
      "wrong": "ArrowLeft",
      "next": "ArrowRight"
    },
    "spelling": {
      "playAudio": "ArrowLeft",
      "forgot": "ArrowRight",
      "next": "Enter"
    }
  }
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM user_config WHERE user_id = 1);

-- =============================================
-- Table: relation_generation_log
-- AI relation generation progress tracking
-- =============================================

CREATE TABLE IF NOT EXISTS relation_generation_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    relation_type relation_type_enum NOT NULL,
    processed_at TIMESTAMP NOT NULL,
    found_count INTEGER DEFAULT 0,
    CONSTRAINT uq_word_relation_log UNIQUE(word_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_relation_generation_log_user_id ON relation_generation_log(user_id);

-- =============================================
-- Table: speaking_topics
-- IELTS speaking topics (Part 1 & Part 2)
-- =============================================

CREATE TABLE IF NOT EXISTS speaking_topics (
    id SERIAL PRIMARY KEY,
    part INTEGER NOT NULL,
    title VARCHAR NOT NULL
);

-- =============================================
-- Table: speaking_questions
-- Questions within speaking topics
-- =============================================

CREATE TABLE IF NOT EXISTS speaking_questions (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER NOT NULL REFERENCES speaking_topics(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL
);

-- =============================================
-- Table: speaking_records
-- User practice recordings with AI feedback
-- =============================================

CREATE TABLE IF NOT EXISTS speaking_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    question_id INTEGER NOT NULL REFERENCES speaking_questions(id) ON DELETE CASCADE,
    user_answer TEXT,
    audio_file TEXT,
    ai_feedback TEXT,
    score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_speaking_records_user_id ON speaking_records(user_id);

-- =============================================
-- View: stats_words_raw
-- Raw word data for statistics
-- =============================================

CREATE OR REPLACE VIEW stats_words_raw AS
SELECT
    user_id,
    id,
    word,
    source,
    ease_factor,
    ROUND(ease_factor::numeric, 2) as ef_rounded,
    ROUND(avg_elapsed_time::numeric) as elapsed_time_rounded,
    next_review,
    spell_next_review,
    (COALESCE(remember_count, 0) + COALESCE(forget_count, 0)) as review_count,
    spell_strength,
    ROUND(spell_strength::numeric, 2) as spell_strength_rounded,
    COALESCE(repetition, 0) as repetition,
    date_added,
    (COALESCE(repetition, 0) >= 3) as spell_available
FROM words
WHERE stop_review = 0;

-- =============================================
-- View: stats_next_review_distribution
-- Words due for review by date
-- =============================================

CREATE OR REPLACE VIEW stats_next_review_distribution AS
SELECT
    user_id,
    source,
    next_review as date,
    COUNT(*) as count
FROM words
WHERE stop_review = 0 AND next_review IS NOT NULL
GROUP BY user_id, source, next_review
ORDER BY user_id, source, next_review;

-- =============================================
-- View: stats_spell_next_review_distribution
-- Words due for spelling by date
-- =============================================

CREATE OR REPLACE VIEW stats_spell_next_review_distribution AS
SELECT
    user_id,
    source,
    spell_next_review as date,
    COUNT(*) as count
FROM words
WHERE stop_review = 0
    AND spell_next_review IS NOT NULL
    AND (COALESCE(repetition, 0) >= 3 OR spell_strength IS NOT NULL)
GROUP BY user_id, source, spell_next_review
ORDER BY user_id, source, spell_next_review;

-- =============================================
-- View: stats_elapsed_time_distribution
-- Words by average response time
-- =============================================

CREATE OR REPLACE VIEW stats_elapsed_time_distribution AS
SELECT
    user_id,
    source,
    ROUND(avg_elapsed_time::numeric) as elapsed_time,
    COUNT(*) as count
FROM words
WHERE stop_review = 0 AND avg_elapsed_time IS NOT NULL
GROUP BY user_id, source, ROUND(avg_elapsed_time::numeric)
ORDER BY user_id, source, elapsed_time;

-- =============================================
-- View: stats_review_count_distribution
-- Words by total review count
-- =============================================

CREATE OR REPLACE VIEW stats_review_count_distribution AS
SELECT
    user_id,
    source,
    (COALESCE(remember_count, 0) + COALESCE(forget_count, 0)) as review_count,
    COUNT(*) as count
FROM words
WHERE stop_review = 0
GROUP BY user_id, source, (COALESCE(remember_count, 0) + COALESCE(forget_count, 0))
ORDER BY user_id, source, review_count;

-- =============================================
-- View: stats_added_date_distribution
-- Words by date added
-- =============================================

CREATE OR REPLACE VIEW stats_added_date_distribution AS
SELECT
    user_id,
    source,
    date_added as date,
    COUNT(*) as count
FROM words
WHERE stop_review = 0 AND date_added IS NOT NULL
GROUP BY user_id, source, date_added
ORDER BY user_id, source, date_added;

-- =============================================
-- View: word_source_stats
-- Aggregated statistics per source
-- =============================================

CREATE OR REPLACE VIEW word_source_stats AS
SELECT
    user_id,
    source,
    count(*) AS total,
    count(*) FILTER (WHERE stop_review = 1) AS remembered,
    count(*) FILTER (WHERE stop_review = 0) AS unremembered,
    count(*) FILTER (WHERE stop_review = 0 AND next_review IS NOT NULL AND next_review <= CURRENT_DATE) AS due_count,
    count(*) FILTER (WHERE stop_review = 0 AND lapse > 0) AS lapse_count,
    count(*) FILTER (WHERE stop_review = 0 AND (repetition >= 3 OR spell_strength IS NOT NULL)) AS spelling_count,
    count(*) FILTER (WHERE stop_review = 0 AND (repetition >= 3 OR spell_strength IS NOT NULL) AND (spell_next_review IS NULL OR spell_next_review <= CURRENT_DATE)) AS today_spell_count
FROM words
GROUP BY user_id, source;

-- =============================================
-- View: relation_stats
-- Relation counts by type (divided by 2 for bidirectional)
-- =============================================

CREATE OR REPLACE VIEW relation_stats AS
SELECT
    user_id,
    relation_type,
    count(*) / 2 AS count
FROM words_relations
GROUP BY user_id, relation_type;

-- =============================================
-- Storage Bucket (create manually in Supabase Dashboard)
-- =============================================
-- Bucket name: speaking-audios
-- Public: No
-- Allowed MIME types: audio/*
-- Max file size: 10MB

-- =============================================
-- Migration Complete
-- =============================================
