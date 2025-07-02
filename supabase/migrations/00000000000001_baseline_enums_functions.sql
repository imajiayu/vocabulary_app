-- =============================================
-- Baseline Part 1: Enum Types & Functions
-- =============================================

-- =========================
-- Enum Types
-- =========================

DO $$ BEGIN
    CREATE TYPE relation_type_enum AS ENUM ('synonym', 'antonym', 'root', 'confused', 'topic');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =========================
-- Functions
-- =========================

-- Trigger function: auto-update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;
