-- Add missing foreign key on review_history.user_id for cascade delete
ALTER TABLE review_history
  ADD CONSTRAINT review_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
