-- ====================================================================
-- 동호회 로고 URL 컬럼 추가 (squads.logo_url)
-- ====================================================================
-- Storage 경로 컨벤션: squads/{squad_id}.jpg (avatars 버킷 재사용)
-- 운영자만 업로드/변경 가능 (UI 에서 isAdmin 분기).
-- DB 자체에는 UPDATE 권한 RLS 가 이미 squad owner/admin 으로 제한되어 있다.
ALTER TABLE public.squads
  ADD COLUMN IF NOT EXISTS logo_url text;
