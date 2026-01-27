# Database Schema

*IELTS Vocabulary App - Supabase PostgreSQL*

## Overview

| Category | Count |
|----------|-------|
| Tables | 8 |
| Views | 8 |
| Storage Buckets | 1 |
| Edge Functions | 2 |

---

## Tables

### words

Core vocabulary table with SM-2 spaced repetition fields.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | serial | NO | - | Primary key |
| user_id | integer | NO | 1 | User identifier |
| word | varchar | NO | - | The vocabulary word |
| definition | text | YES | - | JSON: phonetic, definitions, examples |
| date_added | date | YES | CURRENT_DATE | Date word was added |
| remember_count | integer | YES | 0 | Times remembered |
| forget_count | integer | YES | 0 | Times forgotten |
| last_remembered | date | YES | - | Last remembered date |
| last_forgot | date | YES | - | Last forgotten date |
| stop_review | integer | YES | 0 | 1 = mastered, excluded from review |
| next_review | date | YES | - | Next review date (SM-2) |
| interval | integer | YES | 1 | Review interval in days (SM-2) |
| repetition | integer | YES | 0 | Successful repetitions (SM-2) |
| ease_factor | float | YES | 2.5 | Difficulty factor (SM-2) |
| last_score | integer | YES | 0 | Last review score |
| avg_elapsed_time | integer | YES | 0 | Average response time (ms) |
| lapse | integer | YES | 0 | Lapse counter |
| spell_strength | float | YES | - | Spelling strength (0-1) |
| spell_next_review | date | YES | - | Next spelling review date |
| source | varchar(20) | NO | - | Word source (IELTS, GRE, etc.) |

**Constraints:**
- PK: `id`
- UNIQUE: `(word, user_id, source)` — unique_word_per_user

**Indexes:**
- `idx_words_user_id` ON (user_id)

---

### words_relations

Bidirectional word relationships (synonym, antonym, root, confused, topic).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | serial | NO | - |
| user_id | integer | NO | 1 |
| word_id | integer | NO | - |
| related_word_id | integer | NO | - |
| relation_type | relation_type_enum | NO | - |
| confidence | float | YES | 1.0 |

**Constraints:**
- PK: `id`
- FK: `word_id` → `words.id`
- FK: `related_word_id` → `words.id`
- UNIQUE: `(word_id, related_word_id, relation_type)` — uq_word_relation_type

**Indexes:**
- `idx_words_relations_user_id` ON (user_id)

---

### current_progress

Learning session progress per user (one row per user). Used by frontend for progress restore.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | serial | NO | - | Primary key |
| user_id | integer | NO | 1 | User identifier |
| mode | varchar | YES | - | Review mode (mode_review, mode_lapse, mode_spelling) |
| source | varchar(20) | YES | - | Current word source |
| shuffle | boolean | YES | - | Shuffle enabled |
| word_ids_snapshot | text | YES | - | JSON array of word IDs |
| current_index | integer | YES | - | Current position in queue |
| initial_lapse_count | integer | YES | 0 | Initial total lapse count |
| initial_lapse_word_count | integer | YES | 0 | Initial word count with lapse |

**Constraints:**
- PK: `id`
- UNIQUE: `(user_id)` — unique_progress_per_user

**Note:** This table is accessed directly by frontend via Supabase, not through backend API.

---

### user_config

User configuration stored as JSON (one row per user).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | serial | NO | - |
| user_id | integer | NO | 1 |
| config | jsonb | YES | - |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |

**Constraints:**
- PK: `id`
- UNIQUE: `(user_id)` — unique_config_per_user

---

### relation_generation_log

Tracks AI relation generation progress per word.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | serial | NO | - |
| user_id | integer | NO | 1 |
| word_id | integer | NO | - |
| relation_type | relation_type_enum | NO | - |
| processed_at | timestamp | NO | - |
| found_count | integer | YES | 0 |

**Constraints:**
- PK: `id`
- FK: `word_id` → `words.id`
- UNIQUE: `(word_id, relation_type)` — uq_word_relation_log

**Indexes:**
- `idx_relation_generation_log_user_id` ON (user_id)

---

### speaking_topics

IELTS speaking practice topics (Part 1 & Part 2).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | serial | NO | - |
| part | integer | NO | - |
| title | varchar | NO | - |

**Constraints:**
- PK: `id`

---

### speaking_questions

Questions within speaking topics.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | serial | NO | - |
| topic_id | integer | NO | - |
| question_text | text | NO | - |

**Constraints:**
- PK: `id`
- FK: `topic_id` → `speaking_topics.id` ON DELETE CASCADE

---

### speaking_records

User practice recordings with AI feedback.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | serial | NO | - |
| user_id | integer | NO | 1 |
| question_id | integer | NO | - |
| user_answer | text | YES | - |
| audio_file | text | YES | - |
| ai_feedback | text | YES | - |
| score | integer | YES | 0 |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |

**Constraints:**
- PK: `id`
- FK: `question_id` → `speaking_questions.id` ON DELETE CASCADE

**Indexes:**
- `idx_speaking_records_user_id` ON (user_id)

---

## Views

### stats_words_raw

Raw word data for statistics (EF, spell strength, heatmaps).

```sql
SELECT
    user_id, id, word, source, ease_factor,
    ROUND(ease_factor::numeric, 2) as ef_rounded,
    ROUND(avg_elapsed_time::numeric) as elapsed_time_rounded,
    next_review, spell_next_review,
    (COALESCE(remember_count, 0) + COALESCE(forget_count, 0)) as review_count,
    spell_strength,
    ROUND(spell_strength::numeric, 2) as spell_strength_rounded,
    COALESCE(repetition, 0) as repetition,
    date_added,
    (COALESCE(repetition, 0) >= 3) as spell_available
FROM words
WHERE stop_review = 0
```

---

### stats_next_review_distribution

Words due for review by date.

```sql
SELECT user_id, source, next_review as date, COUNT(*) as count
FROM words
WHERE stop_review = 0 AND next_review IS NOT NULL
GROUP BY user_id, source, next_review
```

---

### stats_spell_next_review_distribution

Words due for spelling by date.

```sql
SELECT user_id, source, spell_next_review as date, COUNT(*) as count
FROM words
WHERE stop_review = 0
    AND spell_next_review IS NOT NULL
    AND (COALESCE(repetition, 0) >= 3 OR spell_strength IS NOT NULL)
GROUP BY user_id, source, spell_next_review
```

---

### stats_elapsed_time_distribution

Words by average response time.

```sql
SELECT user_id, source, ROUND(avg_elapsed_time::numeric) as elapsed_time, COUNT(*) as count
FROM words
WHERE stop_review = 0 AND avg_elapsed_time IS NOT NULL
GROUP BY user_id, source, ROUND(avg_elapsed_time::numeric)
```

---

### stats_review_count_distribution

Words by total review count.

```sql
SELECT user_id, source,
    (COALESCE(remember_count, 0) + COALESCE(forget_count, 0)) as review_count,
    COUNT(*) as count
FROM words
WHERE stop_review = 0
GROUP BY user_id, source, (COALESCE(remember_count, 0) + COALESCE(forget_count, 0))
```

---

### stats_added_date_distribution

Words by date added.

```sql
SELECT user_id, source, date_added as date, COUNT(*) as count
FROM words
WHERE stop_review = 0 AND date_added IS NOT NULL
GROUP BY user_id, source, date_added
```

---

### word_source_stats

Aggregated statistics per source.

```sql
SELECT
    user_id, source,
    count(*) AS total,
    count(*) FILTER (WHERE stop_review = 1) AS remembered,
    count(*) FILTER (WHERE stop_review = 0) AS unremembered,
    count(*) FILTER (WHERE stop_review = 0 AND next_review IS NOT NULL AND next_review <= CURRENT_DATE) AS due_count,
    count(*) FILTER (WHERE stop_review = 0 AND lapse > 0) AS lapse_count,
    count(*) FILTER (WHERE stop_review = 0 AND (repetition >= 3 OR spell_strength IS NOT NULL)) AS spelling_count,
    count(*) FILTER (WHERE stop_review = 0 AND (repetition >= 3 OR spell_strength IS NOT NULL) AND (spell_next_review IS NULL OR spell_next_review <= CURRENT_DATE)) AS today_spell_count
FROM words
GROUP BY user_id, source
```

---

### relation_stats

Relation counts by type.

```sql
SELECT user_id, relation_type, count(*) / 2 AS count
FROM words_relations
GROUP BY user_id, relation_type
```

---

## Storage Buckets

| Bucket | Purpose |
|--------|---------|
| speaking-audios | Audio recordings for speaking practice |

---

## Edge Functions

Located in `/supabase/functions/`:

### adjust-max-prep-days

When `maxPrepDays` setting decreases, adjusts words with `interval` or `next_review` exceeding the new limit.

**Endpoint:** `POST /adjust-max-prep-days`

**Headers:** `x-user-id` (required)

**Body:** `{ "maxPrepDays": number }`

---

### delete-source

Cascade deletes a vocabulary source and all associated words/progress.

**Endpoint:** `POST /delete-source`

**Headers:** `x-user-id` (required)

**Body:** `{ "sourceName": string }`

---

## Enum Types

### relation_type_enum

```sql
CREATE TYPE relation_type_enum AS ENUM ('synonym', 'antonym', 'root', 'confused', 'topic');
```
