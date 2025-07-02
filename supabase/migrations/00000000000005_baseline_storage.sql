-- =============================================
-- Baseline Part 5: Storage Buckets & Policies
-- =============================================
-- 2 storage buckets, 3 edge functions (deployed separately)
--
-- NOTE: Storage buckets and their policies must be created via
-- Supabase Dashboard or supabase CLI, not plain SQL migrations.
-- This file serves as documentation of the required configuration.

-- =========================
-- Bucket: speaking-audios
-- =========================
-- Public bucket for speaking practice audio recordings
-- Files: user_{UUID}/recording_{timestamp}.wav
-- Allowed MIME types: audio/*
-- Max file size: 10MB

-- Upload policy (authenticated users to their own folder)
-- CREATE POLICY "Users upload to own folder" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (
--     bucket_id = 'speaking-audios'
--     AND (storage.foldername(name))[1] = 'user_' || auth.uid()::text
--   );

-- Read policy (all authenticated users)
-- CREATE POLICY "Authenticated read speaking audios" ON storage.objects
--   FOR SELECT TO authenticated
--   USING (bucket_id = 'speaking-audios');

-- Delete policy (own folder only)
-- CREATE POLICY "Users delete from own folder" ON storage.objects
--   FOR DELETE TO authenticated
--   USING (
--     bucket_id = 'speaking-audios'
--     AND (storage.foldername(name))[1] = 'user_' || auth.uid()::text
--   );

-- =========================
-- Bucket: writing-images
-- =========================
-- Public bucket for writing prompt images
-- Files: user_{UUID}/{filename}

-- Upload policy
-- CREATE POLICY "Users upload writing images" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (
--     bucket_id = 'writing-images'
--     AND (storage.foldername(name))[1] = 'user_' || auth.uid()::text
--   );

-- Read policy
-- CREATE POLICY "Authenticated read writing images" ON storage.objects
--   FOR SELECT TO authenticated
--   USING (bucket_id = 'writing-images');

-- Delete policy
-- CREATE POLICY "Users delete writing images" ON storage.objects
--   FOR DELETE TO authenticated
--   USING (
--     bucket_id = 'writing-images'
--     AND (storage.foldername(name))[1] = 'user_' || auth.uid()::text
--   );

-- =========================
-- Edge Functions (deployed from /supabase/functions/)
-- =========================
-- 1. adjust-max-prep-days  — Adjusts words exceeding new maxPrepDays limit
-- 2. delete-source         — Cascade deletes a vocabulary source and all data
-- 3. fetch-definition      — CORS proxy for youdao.com word definitions
