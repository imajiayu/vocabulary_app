-- Migration: Add user_config and task_progress tables
-- Date: 2026-01-20
-- Purpose: Store user configuration and relation generation progress in database
--          to support Serverless environments (Vercel)

-- =============================================
-- Table: user_config
-- Purpose: Store user configuration as JSON (single row)
-- =============================================
CREATE TABLE IF NOT EXISTS user_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    config_json TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_config_single_row CHECK (id = 1)
);

-- Insert default configuration if not exists
INSERT INTO user_config (id, config_json)
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
}'
WHERE NOT EXISTS (SELECT 1 FROM user_config WHERE id = 1);

-- =============================================
-- Table: task_progress
-- Purpose: Store relation generation progress
-- =============================================
CREATE TABLE IF NOT EXISTS task_progress (
    id SERIAL PRIMARY KEY,
    relation_type VARCHAR(20) NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'pending',
    current_progress INTEGER DEFAULT 0,
    total_words INTEGER DEFAULT 0,
    percent FLOAT DEFAULT 0.0,
    message TEXT DEFAULT '',
    error_message TEXT DEFAULT '',
    total_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups by relation_type
CREATE INDEX IF NOT EXISTS idx_task_progress_relation_type ON task_progress(relation_type);
