-- ============================================================================
-- Writing 模块 V2 改动 - 数据库迁移
-- 1. 版本数量从 3 改为 2 (初稿 + 终稿)
-- 2. 笔记从 session 级别改为 prompt 级别
-- ============================================================================

-- 1. 修改 version_number 约束：(1, 2, 3) → (1, 2)
ALTER TABLE writing_versions DROP CONSTRAINT writing_versions_version_number_check;
ALTER TABLE writing_versions ADD CONSTRAINT writing_versions_version_number_check
  CHECK (version_number IN (1, 2));

-- 2. 为 prompts 添加 notes 字段（题目级别的笔记）
ALTER TABLE writing_prompts ADD COLUMN notes TEXT;

-- 3. 删除 sessions 中的 notes 字段（笔记改为 prompt 级别）
ALTER TABLE writing_sessions DROP COLUMN notes;
