-- 课程进度跨设备同步
CREATE TABLE course_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course text NOT NULL,
  progress jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course)
);

-- 自动更新 updated_at
CREATE TRIGGER trg_course_progress_updated_at
  BEFORE UPDATE ON course_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS：用户只能访问自己的进度
ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_progress" ON course_progress
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
