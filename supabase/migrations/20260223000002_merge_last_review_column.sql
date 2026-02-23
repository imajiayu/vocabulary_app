-- 合并 last_remembered + last_forgot → last_review
-- 两个字段在所有代码中从未被独立区分使用，合并后与 last_spell 对称

ALTER TABLE words ADD COLUMN last_review DATE;
UPDATE words SET last_review = GREATEST(last_remembered, last_forgot);
ALTER TABLE words DROP COLUMN last_remembered;
ALTER TABLE words DROP COLUMN last_forgot;
