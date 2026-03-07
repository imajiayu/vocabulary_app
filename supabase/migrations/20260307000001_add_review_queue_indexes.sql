-- Partial indexes for review/spelling queue queries
-- These cover the common WHERE stop_review=0 / stop_spell=0 filters

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_words_review_queue
  ON words (user_id, stop_review, next_review) WHERE stop_review = 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_words_spell_queue
  ON words (user_id, stop_spell, spell_next_review) WHERE stop_spell = 0;
