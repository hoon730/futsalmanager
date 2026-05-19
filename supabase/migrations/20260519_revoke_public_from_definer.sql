-- ====================================================================
-- SECURITY DEFINER 함수의 PUBLIC EXECUTE 권한 회수
-- 기존 harden_definer_functions.sql 은 FROM anon 만 했고
-- FROM PUBLIC 을 빠뜨려, anon 이 PUBLIC 을 상속받아 호출 가능했음.
-- (Supabase database linter 0028 경고)
-- ====================================================================

-- ── 비즈니스 RPC: PUBLIC + anon 회수, authenticated 만 부여 ──────
REVOKE EXECUTE ON FUNCTION public.create_squad_with_owner(text, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_squad_with_owner(text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.find_squad_by_invite_code(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.find_squad_by_invite_code(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.leave_squad(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.leave_squad(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.regenerate_invite_code(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.regenerate_invite_code(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_my_linked_member(text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_my_linked_member(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.link_my_member(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.link_my_member(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.unlink_my_member() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.unlink_my_member() TO authenticated;

-- ── RLS 헬퍼 함수: PUBLIC + anon 회수, authenticated 만 부여 ─────
-- 외부 RPC 노출은 막을 수 없지만(PostgREST 자동 노출) anon 호출은 차단
REVOKE EXECUTE ON FUNCTION public.is_squad_admin(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_squad_admin(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_squad_member(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_squad_member(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_admin_squad_ids() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_admin_squad_ids() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_owned_squad_ids() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_owned_squad_ids() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_squad_ids() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_squad_ids() TO authenticated;
