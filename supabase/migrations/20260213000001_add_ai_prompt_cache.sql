-- AI Prompt Cache: shared table for caching DeepSeek responses
-- Key: (word, prompt_type), immutable entries, no TTL

CREATE TABLE IF NOT EXISTS ai_prompt_cache (
    id SERIAL PRIMARY KEY,
    word VARCHAR NOT NULL,
    prompt_type VARCHAR(20) NOT NULL,  -- collocation/sentence/memory/synonym_antonym
    response TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_word_prompt UNIQUE (word, prompt_type)
);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_cache_word ON ai_prompt_cache (word);

ALTER TABLE ai_prompt_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_can_read" ON ai_prompt_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "anyone_can_insert" ON ai_prompt_cache FOR INSERT TO authenticated WITH CHECK (true);
