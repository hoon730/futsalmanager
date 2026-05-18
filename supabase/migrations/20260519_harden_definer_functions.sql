-- ====================================================================
-- SECURITY DEFINER 함수 보안 강화
-- 1. 트리거 함수의 search_path 고정 (변조 위험 제거)
-- 2. 트리거 함수의 REST RPC 노출 차단 (외부에서 호출될 일 없음)
-- 3. 인증 후에만 호출되는 RPC들에서 anon EXECUTE 권한 제거
-- ====================================================================

-- 1. 트리거 함수 search_path 고정
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.promote_waitlist_on_cancel() SET search_path = public;

-- 2. 트리거 함수의 REST RPC 노출 차단
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_waitlist_on_cancel() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 3. 비즈니스 RPC는 인증된 사용자만 호출 (모두 내부에서 auth.uid() 검사함)
REVOKE EXECUTE ON FUNCTION public.create_squad_with_owner(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_squad_by_invite_code(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_admin_squad_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_owned_squad_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_squad_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_squad_admin(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_squad_member(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.leave_squad(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.regenerate_invite_code(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_my_linked_member(text, text) FROM anon;

-- 4. push_subscriptions.squad_id에 FK 제약 (squad 삭제 시 구독도 같이 삭제)
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_squad_id_fkey
  FOREIGN KEY (squad_id) REFERENCES public.squads(id) ON DELETE CASCADE;
