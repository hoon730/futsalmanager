-- ====================================================================
-- 잔재 RLS 정책 정리 + owner_id NULL squad 청소
-- ====================================================================
-- 점검 결과 다음 위험 발견:
--   1) squad_members_insert: WITH CHECK (user_id = auth.uid()) 가 남아있어
--      squad_id 만 알면 invite_code 우회 가입 가능
--   2) profiles_select_all: USING (true) — 인증만 되면 모든 프로필 조회
--   3) members_*_legacy_squads: owner_id IS NULL squad 에 누구나 read/write
--      → 운영 DB 의 squad 10 개 중 8 개가 owner_id NULL 이었음 (멤버 0명 테스트 잔재)
--
-- 모든 핵심 RPC (create_squad_with_owner / join_squad_with_code / leave_squad /
-- find_squad_by_invite_code / regenerate_invite_code / update_my_linked_member)
-- 가 SECURITY DEFINER 이므로 INSERT 정책 없어도 정상 가입/생성 가능.
-- ====================================================================

-- 1. owner_id NULL 빈 squad 청소 (모두 멤버 0명 테스트 잔재 확인됨)
DELETE FROM public.squads WHERE owner_id IS NULL;

-- 2. squad_members 의 일반 INSERT 정책 제거 → SECURITY DEFINER RPC 전용
DROP POLICY IF EXISTS "squad_members_insert" ON public.squad_members;

-- 3. profiles 의 무조건 SELECT 정책 제거
-- "Users can view own profile" + "Squad members can view squadmate profiles" 로 충분
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;

-- 4. legacy squad 백도어 정책 3개 제거
DROP POLICY IF EXISTS "members_write_legacy_squads" ON public.members;
DROP POLICY IF EXISTS "members_update_legacy_squads" ON public.members;
DROP POLICY IF EXISTS "members_delete_legacy_squads" ON public.members;
