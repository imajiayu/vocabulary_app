-- 为现有用户补充 sourceOrder 字段
-- sourceOrder 显式控制 source 显示顺序（jsonb 不保留对象键顺序）
UPDATE user_config
SET config = jsonb_set(
  config,
  '{sources,sourceOrder}',
  (
    SELECT jsonb_agg(key)
    FROM jsonb_object_keys(config -> 'sources' -> 'customSources') AS key
  )
)
WHERE config -> 'sources' -> 'customSources' IS NOT NULL
  AND config -> 'sources' -> 'sourceOrder' IS NULL;
