-- ====================================================================
-- Storage 버킷: avatars (프로필/멤버/동호회 로고)
-- ====================================================================
-- 경로 컨벤션:
--   profiles/{user_id}.{ext}   - 인증 유저의 프로필 사진
--   members/{member_id}.{ext}  - 정규 멤버 사진 (관리자가 업로드)
--   squads/{squad_id}.{ext}    - 동호회 로고 (운영자만)
--
-- 정책: public 버킷 — 누구나 SELECT (CDN 캐시 활용),
--       authenticated 유저는 INSERT/UPDATE/DELETE 모두 가능.
--       세부 권한(자기 파일만 수정 등)은 클라이언트 로직으로 처리.
-- ====================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5 * 1024 * 1024, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5 * 1024 * 1024,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 누구나 읽기 (public 버킷이지만 RLS 정책 명시)
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
CREATE POLICY "avatars_select_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- 인증 유저는 업로드/수정/삭제 가능
DROP POLICY IF EXISTS "avatars_insert_authenticated" ON storage.objects;
CREATE POLICY "avatars_insert_authenticated" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "avatars_update_authenticated" ON storage.objects;
CREATE POLICY "avatars_update_authenticated" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "avatars_delete_authenticated" ON storage.objects;
CREATE POLICY "avatars_delete_authenticated" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
