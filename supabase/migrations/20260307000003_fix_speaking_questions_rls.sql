-- Strengthen INSERT policy: verify topic_id belongs to the inserting user
DROP POLICY IF EXISTS "insert_own" ON speaking_questions;

CREATE POLICY "insert_own" ON speaking_questions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM speaking_topics
      WHERE id = topic_id AND user_id = auth.uid()
    )
  );
