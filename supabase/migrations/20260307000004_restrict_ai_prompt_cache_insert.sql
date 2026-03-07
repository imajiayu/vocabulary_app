-- Add created_by column and restrict INSERT to owner
ALTER TABLE ai_prompt_cache ADD COLUMN created_by UUID REFERENCES auth.users(id);

DROP POLICY IF EXISTS "anyone_can_insert" ON ai_prompt_cache;

CREATE POLICY "insert_with_owner" ON ai_prompt_cache FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
