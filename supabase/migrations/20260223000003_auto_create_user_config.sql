-- 新用户注册时自动创建 user_config 默认记录
-- 避免 Edge Function 等查询 .single() 因无记录而报错

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_config (user_id, config)
  VALUES (NEW.id, '{}'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 补全已有用户的 user_config 记录
INSERT INTO public.user_config (user_id, config)
SELECT id, '{}'::jsonb FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
