-- words 表加 updated_at 列 + BEFORE UPDATE 触发器 + 指纹查询函数
-- 用途：客户端缓存 stale-while-revalidate，指纹 = (count, max(updated_at))

-- 1. 加列：DEFAULT now() 自动覆盖 INSERT 路径
ALTER TABLE words
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- 2. 历史 backfill：用业务时间戳推断"最后变动"
--    优先级：last_review > last_spell > date_added，全空时保留 now()
UPDATE words
SET updated_at = COALESCE(
  last_review::timestamptz,
  last_spell::timestamptz,
  date_added::timestamptz,
  now()
);

-- 3. 触发器：仿 trg_user_config_updated_at（baseline_tables.sql:81）
--    update_updated_at() 函数已存在（baseline_enums_functions.sql:19）
CREATE TRIGGER trg_words_updated_at
  BEFORE UPDATE ON words
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 4. 指纹查询函数：单次往返拿 (count, max_updated_at)
--    SECURITY INVOKER + auth.uid()：依赖 RLS 隔离用户数据
CREATE OR REPLACE FUNCTION public.get_words_fingerprint()
RETURNS TABLE (word_count bigint, max_updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT count(*)::bigint, max(updated_at)
  FROM words
  WHERE user_id = auth.uid();
$$;
