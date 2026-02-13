# Database Schema

*IELTS Vocabulary App — Supabase PostgreSQL*

## Overview

| Category | Count |
|----------|-------|
| Enum Types | 1 |
| Functions | 1 |
| Triggers | 1 |
| Tables | 13 |
| Views | 13 |
| Storage Buckets | 2 |
| Edge Functions | 3 |

---

## Enum Types

### relation_type_enum

```sql
CREATE TYPE relation_type_enum AS ENUM ('synonym', 'antonym', 'root', 'confused', 'topic');
```

---

## Functions

### update_updated_at()

Trigger function that sets `updated_at = now()` before UPDATE. Used by `user_config`.

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
```

---

## Tables

### words

SM-2 spaced repetition vocabulary.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | serial | NO | auto | Primary key |
| user_id | uuid | NO | — | User identifier (Supabase Auth UUID) |
| word | varchar | NO | — | The vocabulary word |
| definition | varchar | YES | — | JSON: phonetic, definitions, examples |
| date_added | date | YES | — | Date word was added |
| remember_count | integer | YES | — | Times remembered |
| forget_count | integer | YES | — | Times forgotten |
| last_remembered | date | YES | — | Last remembered date |
| last_forgot | date | YES | — | Last forgotten date |
| stop_review | integer | YES | — | 1 = mastered, excluded from review |
| next_review | date | YES | — | Next review date (SM-2) |
| interval | integer | YES | — | Review interval in days (SM-2) |
| repetition | integer | YES | — | Successful repetitions (SM-2) |
| ease_factor | double precision | YES | — | Difficulty factor (SM-2) |
| last_score | integer | YES | — | Last review score |
| avg_elapsed_time | integer | YES | — | Average response time (ms) |
| lapse | integer | YES | — | Lapse counter |
| spell_strength | double precision | YES | — | Spelling strength (0-1) |
| spell_next_review | date | YES | — | Next spelling review date |
| source | varchar(20) | NO | — | Word source (IELTS, GRE, etc.) |

**Constraints:** PK `id`, UNIQUE `(word, user_id, source)`

**Indexes:** `idx_words_user_id` ON (user_id)

---

### words_relations

Bidirectional word relationships (synonym, antonym, root, confused, topic).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | serial | NO | auto |
| user_id | uuid | NO | — |
| word_id | integer | NO | — |
| related_word_id | integer | NO | — |
| relation_type | relation_type_enum | NO | — |
| confidence | double precision | YES | — |

**Constraints:** PK `id`, FK `word_id → words.id`, FK `related_word_id → words.id`, UNIQUE `(word_id, related_word_id, relation_type)`

**Indexes:** `idx_words_relations_user_id` ON (user_id)

---

### current_progress

Learning session progress per user (one row per user). Frontend direct access for progress restore.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | serial | NO | auto |
| user_id | uuid | NO | — |
| mode | varchar(20) | YES | — |
| source | varchar(10) | YES | — |
| shuffle | boolean | YES | — |
| word_ids_snapshot | text | YES | — |
| current_index | integer | YES | — |
| initial_lapse_count | integer | YES | — |
| initial_lapse_word_count | integer | YES | — |

**Constraints:** PK `id`, UNIQUE `(user_id)`

---

### user_config

User configuration stored as JSONB (one row per user).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | serial | NO | auto |
| user_id | uuid | NO | — |
| config | jsonb | YES | — |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |

**Constraints:** PK `id`, UNIQUE `(user_id)`

**Trigger:** `trg_user_config_updated_at` BEFORE UPDATE → `update_updated_at()`

---

### relation_generation_log

AI relation generation progress tracking.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | serial | NO | auto |
| user_id | uuid | NO | — |
| word_id | integer | NO | — |
| relation_type | relation_type_enum | NO | — |
| processed_at | timestamp | NO | — |
| found_count | integer | YES | — |

**Constraints:** PK `id`, FK `word_id → words.id`, UNIQUE `(word_id, relation_type)`

**Indexes:** `idx_relation_generation_log_user_id` ON (user_id)

---

### speaking_topics

IELTS speaking practice topics (Part 1 & Part 2).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | serial | NO | auto |
| user_id | uuid | NO | — |
| part | integer | NO | — |
| title | varchar(200) | NO | — |

**Constraints:** PK `id`, UNIQUE `(user_id, part, title)`

**Indexes:** `idx_speaking_topics_user_id` ON (user_id)

---

### speaking_questions

Questions within speaking topics.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | serial | NO | auto |
| user_id | uuid | NO | — |
| topic_id | integer | NO | — |
| question_text | text | NO | — |

**Constraints:** PK `id`, FK `topic_id → speaking_topics.id ON DELETE CASCADE`

**Indexes:** `idx_speaking_questions_user_id` ON (user_id)

---

### speaking_records

User practice recordings with AI feedback.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | serial | NO | auto |
| user_id | uuid | NO | — |
| question_id | integer | NO | — |
| user_answer | text | YES | — |
| audio_file | varchar(255) | YES | — |
| ai_feedback | text | YES | — |
| score | numeric(3,1) | YES | — |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |

**Constraints:** PK `id`, FK `question_id → speaking_questions.id ON DELETE CASCADE`

**Indexes:** `idx_speaking_records_user_id` ON (user_id)

---

### writing_folders

Writing practice folders for organizing prompts.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | serial | NO | auto |
| user_id | uuid | NO | — |
| name | varchar(100) | NO | — |
| sort_order | integer | YES | 0 |
| created_at | timestamptz | YES | now() |

**Constraints:** PK `id`, UNIQUE `(user_id, name)`

**Indexes:** `idx_writing_folders_user` ON (user_id)

---

### writing_prompts

IELTS writing task prompts (Task 1 or Task 2).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | serial | NO | auto |
| user_id | uuid | NO | — |
| folder_id | integer | YES | — |
| task_type | integer | NO | — |
| prompt_text | text | NO | — |
| image_url | text | YES | — |
| sort_order | integer | YES | 0 |
| created_at | timestamptz | YES | now() |

**Constraints:** PK `id`, FK `folder_id → writing_folders.id ON DELETE SET NULL`, CHECK `task_type IN (1, 2)`

**Indexes:** `idx_writing_prompts_user` ON (user_id), `idx_writing_prompts_folder` ON (user_id, folder_id)

---

### writing_sessions

Individual writing practice sessions with multi-phase workflow.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | serial | NO | auto | Primary key |
| user_id | uuid | NO | — | User identifier (Supabase Auth UUID) |
| prompt_id | integer | YES | — | Reference to prompt |
| time_limit | integer | NO | — | Time limit in seconds |
| time_spent | integer | YES | — | Actual time spent (seconds) |
| status | varchar(20) | YES | 'writing' | Workflow phase |
| notes | text | YES | — | User notes |
| created_at | timestamptz | YES | now() | Creation timestamp |
| completed_at | timestamptz | YES | — | Completion timestamp |
| outline | text | YES | — | Planning outline |
| draft_content | text | YES | — | Draft essay |
| final_content | text | YES | — | Revised final essay |
| feedback | jsonb | YES | — | AI feedback JSON |
| scores | jsonb | YES | — | AI scoring JSON |
| word_count | integer | YES | — | Word count |

**Constraints:** PK `id`, FK `prompt_id → writing_prompts.id ON DELETE SET NULL`, CHECK `status IN ('outline', 'writing', 'feedback', 'revision', 'completed')`

**Indexes:** `idx_writing_sessions_user` ON (user_id), `idx_writing_sessions_status` ON (user_id, status), `idx_writing_sessions_prompt` ON (prompt_id)

---

### review_history

Per-review event log for trend analysis and statistics. Written fire-and-forget from frontend on each review/spelling submission.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigserial | NO | auto | Primary key |
| user_id | uuid | NO | — | User identifier (Supabase Auth UUID) |
| word_id | integer | NO | — | FK → words.id |
| reviewed_at | timestamptz | NO | NOW() | When the review happened |
| score | integer | YES | — | Review score (1-5) |
| remembered | boolean | NO | — | Whether the word was remembered |
| elapsed_time | integer | YES | — | Response time (seconds) |
| mode | varchar(10) | NO | — | 'review' or 'spelling' |
| source | varchar(20) | NO | — | Word source (IELTS, GRE, etc.) |

**Constraints:** PK `id`, FK `word_id → words.id ON DELETE CASCADE`, CHECK `score >= 1 AND score <= 5`, CHECK `mode IN ('review', 'spelling')`

**Indexes:** `idx_review_history_user_date` ON (user_id, reviewed_at)

**RLS Policies:**

| Policy | Operation | Rule |
|--------|-----------|------|
| Users can read own review history | SELECT | `auth.uid() = user_id` |
| Users can insert own review history | INSERT | `auth.uid() = user_id` |

---

### ai_prompt_cache

Shared cache for AI vocabulary assistant responses. No `user_id` — all authenticated users share the same cache. Entries are immutable (no UPDATE/DELETE policies).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | serial | NO | auto | Primary key |
| word | varchar | NO | — | Normalized word (lowercase, trimmed) |
| prompt_type | varchar(20) | NO | — | collocation / sentence / memory / synonym_antonym |
| response | text | NO | — | Cached DeepSeek response |
| created_at | timestamptz | NO | NOW() | Creation timestamp |

**Constraints:** PK `id`, UNIQUE `(word, prompt_type)`

**Indexes:** `idx_ai_prompt_cache_word` ON (word)

**RLS Policies:**

| Policy | Operation | Rule |
|--------|-----------|------|
| anyone_can_read | SELECT | `true` (all authenticated users) |
| anyone_can_insert | INSERT | `true` (all authenticated users) |

---

## Views

### stats_words_raw

Raw word data for statistics (EF, spell strength, heatmaps, accuracy).

```sql
SELECT user_id, id, word, source, ease_factor,
    ROUND(ease_factor::numeric, 2) AS ef_rounded,
    ROUND(avg_elapsed_time::numeric) AS elapsed_time_rounded,
    next_review, spell_next_review,
    (COALESCE(remember_count, 0) + COALESCE(forget_count, 0)) AS review_count,
    spell_strength, ROUND(spell_strength::numeric, 2) AS spell_strength_rounded,
    COALESCE(repetition, 0) AS repetition, date_added,
    (COALESCE(repetition, 0) >= 3) AS spell_available,
    interval, last_score,
    COALESCE(lapse, 0) AS lapse,
    COALESCE(remember_count, 0) AS remember_count,
    COALESCE(forget_count, 0) AS forget_count
FROM words WHERE stop_review = 0;
```

### stats_next_review_distribution

Words due for review by date.

```sql
SELECT user_id, source, next_review AS date, COUNT(*) AS count
FROM words WHERE stop_review = 0 AND next_review IS NOT NULL
GROUP BY user_id, source, next_review;
```

### stats_spell_next_review_distribution

Words due for spelling by date.

```sql
SELECT user_id, source, spell_next_review AS date, COUNT(*) AS count
FROM words WHERE stop_review = 0 AND spell_next_review IS NOT NULL
GROUP BY user_id, source, spell_next_review;
```

### stats_elapsed_time_distribution

Words by average response time.

```sql
SELECT user_id, source, ROUND(avg_elapsed_time::numeric) AS elapsed_time, COUNT(*) AS count
FROM words WHERE stop_review = 0 AND avg_elapsed_time IS NOT NULL
GROUP BY user_id, source, ROUND(avg_elapsed_time::numeric);
```

### stats_review_count_distribution

Words by total review count.

```sql
SELECT user_id, source,
    (COALESCE(remember_count, 0) + COALESCE(forget_count, 0)) AS review_count,
    COUNT(*) AS count
FROM words WHERE stop_review = 0
GROUP BY user_id, source, (COALESCE(remember_count, 0) + COALESCE(forget_count, 0));
```

### stats_added_date_distribution

Words by date added.

```sql
SELECT user_id, source, date_added AS date, COUNT(*) AS count
FROM words WHERE stop_review = 0 AND date_added IS NOT NULL
GROUP BY user_id, source, date_added;
```

### word_source_stats

Aggregated statistics per source.

```sql
SELECT user_id, source,
    count(*) AS total,
    count(*) FILTER (WHERE stop_review = 1) AS remembered,
    count(*) FILTER (WHERE stop_review = 0) AS unremembered,
    count(*) FILTER (WHERE stop_review = 0 AND next_review IS NOT NULL AND next_review <= CURRENT_DATE) AS due_count,
    count(*) FILTER (WHERE stop_review = 0 AND lapse > 0) AS lapse_count,
    count(*) FILTER (WHERE stop_review = 0 AND (repetition >= 3 OR spell_strength IS NOT NULL)) AS spelling_count,
    count(*) FILTER (WHERE stop_review = 0 AND (repetition >= 3 OR spell_strength IS NOT NULL)
        AND (spell_next_review IS NULL OR spell_next_review <= CURRENT_DATE)) AS today_spell_count
FROM words GROUP BY user_id, source;
```

### stats_interval_distribution

Words by review interval in days (active words only).

```sql
SELECT user_id, source,
    interval, COUNT(*) AS count
FROM words WHERE stop_review = 0 AND interval IS NOT NULL
GROUP BY user_id, source, interval;
```

### stats_mastered_overview

Aggregated statistics for mastered words (stop_review = 1).

```sql
SELECT user_id, source,
    COUNT(*) AS total_mastered,
    AVG(ease_factor) AS avg_ease_factor,
    AVG(COALESCE(remember_count, 0) + COALESCE(forget_count, 0)) AS avg_review_count,
    AVG(avg_elapsed_time) AS avg_elapsed_time
FROM words WHERE stop_review = 1
GROUP BY user_id, source;
```

### stats_daily_activity

Daily review activity from review_history (timezone: UTC).

```sql
SELECT user_id, source,
    (reviewed_at AT TIME ZONE 'UTC')::date AS date,
    COUNT(*) AS total_reviews,
    COUNT(*) FILTER (WHERE remembered) AS correct,
    COUNT(*) FILTER (WHERE NOT remembered) AS incorrect,
    COUNT(*) FILTER (WHERE mode = 'review') AS review_mode_count,
    COUNT(*) FILTER (WHERE mode = 'spelling') AS spelling_mode_count
FROM review_history
GROUP BY user_id, source, (reviewed_at AT TIME ZONE 'UTC')::date;
```

### stats_hourly_distribution

Hourly review distribution from review_history (timezone: UTC).

```sql
SELECT user_id, source,
    EXTRACT(HOUR FROM reviewed_at AT TIME ZONE 'UTC')::integer AS hour,
    COUNT(*) AS count
FROM review_history
GROUP BY user_id, source, EXTRACT(HOUR FROM reviewed_at AT TIME ZONE 'UTC')::integer;
```

### relation_stats

Relation counts by type (divided by 2 for bidirectional pairs).

```sql
SELECT user_id, relation_type, count(*) / 2 AS count
FROM words_relations GROUP BY user_id, relation_type;
```

---

## Storage Buckets

| Bucket | Public | Purpose |
|--------|--------|---------|
| speaking-audios | Yes | Audio recordings for speaking practice |
| writing-images | Yes | Images for writing prompts (Task 1 charts/diagrams) |

### speaking-audios RLS Policies

Files organized by user folder: `user_{id}/recording_{timestamp}.wav`

| Policy | Operation | Rule |
|--------|-----------|------|
| Users can upload to their folder | INSERT | `bucket_id = 'speaking-audios' AND foldername[1] LIKE 'user_%'` |
| Public read access for speaking audios | SELECT | `bucket_id = 'speaking-audios'` |
| Users can delete from their folder | DELETE | `bucket_id = 'speaking-audios' AND foldername[1] LIKE 'user_%'` |

### writing-images RLS Policies

Files organized by user folder: `user_{id}/{filename}`

| Policy | Operation | Rule |
|--------|-----------|------|
| Writing images upload | INSERT | `bucket_id = 'writing-images' AND foldername[1] LIKE 'user_%'` |
| Writing images read | SELECT | `bucket_id = 'writing-images'` |
| Writing images delete | DELETE | `bucket_id = 'writing-images' AND foldername[1] LIKE 'user_%'` |

---

## Edge Functions

Located in `/supabase/functions/`.

### adjust-max-prep-days

When `maxPrepDays` setting decreases, adjusts words with `interval` or `next_review` exceeding the new limit.

**Endpoint:** `POST /adjust-max-prep-days`

**Authentication:** JWT Bearer token (user ID extracted from token)

**Request:**
```json
{ "maxPrepDays": 30 }
```

**Response:**
```json
{
  "success": true,
  "affected": {
    "interval": 5,
    "next_review": 3,
    "spell_next_review": 2
  }
}
```

**Logic:**
1. Words with `interval > maxPrepDays` → set `interval = maxPrepDays`, `next_review = today + maxPrepDays`
2. Words with `next_review > maxDate` (but interval OK) → cap `next_review` to `maxDate`
3. Words with `spell_next_review > maxDate` → cap `spell_next_review` to `maxDate`

---

### delete-source

Cascade deletes a vocabulary source and all associated data.

**Endpoint:** `POST /delete-source`

**Authentication:** JWT Bearer token (user ID extracted from token)

**Request:**
```json
{ "sourceName": "GRE" }
```

**Response:**
```json
{
  "success": true,
  "message": "成功删除 source 'GRE'",
  "deleted_words": 150,
  "deleted_progress": 1,
  "remaining_sources": ["IELTS"]
}
```

**Logic:**
1. Validate source exists in `user_config.config.sources.customSources`
2. Require at least 1 source remaining after deletion
3. Delete all words with matching source from `words` table
4. Delete matching progress from `current_progress` table
5. Remove source from `user_config.config.sources.customSources`

---

### fetch-definition

CORS proxy for fetching word definitions from youdao.com. Parses HTML and returns structured definition data (phonetic, definitions, examples). Does NOT bold examples — bolding is done by the frontend.

**Endpoint:** `POST /fetch-definition`

**Request:**
```json
{ "word": "abandon" }
```

**Response:**
```json
{
  "success": true,
  "definition": {
    "phonetic": { "us": "/əˈbændən/", "uk": "/əˈbændən/" },
    "definitions": ["vt. 遗弃；放弃", "n. 放任；狂热"],
    "examples": [
      { "en": "He abandoned his wife and children.", "zh": "他抛弃了妻儿。" }
    ]
  }
}
```

**Logic:**
1. Fetch `https://dict.youdao.com/w/eng/{word}/` with 10s timeout
2. Parse HTML with deno-dom (CSS selectors identical to previous BeautifulSoup implementation)
3. Extract phonetic (UK/US), definitions, and up to 3 examples
4. Return raw data — frontend applies `applyBoldToDefinition()` before writing to DB
