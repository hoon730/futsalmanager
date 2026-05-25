-- ====================================================================
-- 초대 코드 기반 가입을 단일 RPC 로 통합 (보안 강화)
-- ====================================================================
-- 기존 흐름의 약점:
--   1) 클라이언트가 find_squad_by_invite_code 로 squad_id 얻은 뒤
--   2) squad_members.insert 를 직접 호출 (RLS: auth.uid()=user_id 만 검증)
--   → squad_id 만 알면 invite_code 우회로 가입 가능
--
-- 새 흐름:
--   - join_squad_with_code(p_code) RPC 가 invite_code 검증 + INSERT 를
--     모두 처리 (SECURITY DEFINER 로 RLS 우회)
--   - squad_members 의 일반 INSERT 정책은 제거 → default deny
--   - squad 생성 시 자기 자신을 owner 로 등록하는 케이스는
--     create_squad_with_owner RPC 가 이미 SECURITY DEFINER 로 처리
-- ====================================================================

-- 1. join_squad_with_code 신설 — rate limit 도 함께 적용
CREATE OR REPLACE FUNCTION public.join_squad_with_code(p_code text)
RETURNS TABLE (squad_id text, action text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_squad public.squads%ROWTYPE;
  v_existing uuid;
  v_recent_count int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'login required' USING ERRCODE = '42501';
  END IF;

  -- 24h 지난 시도 cleanup
  DELETE FROM public.invite_code_attempts
  WHERE attempted_at < now() - interval '24 hours';

  SELECT count(*) INTO v_recent_count
  FROM public.invite_code_attempts
  WHERE user_id = v_caller
    AND attempted_at > now() - interval '1 hour';

  IF v_recent_count >= 30 THEN
    RAISE EXCEPTION 'rate limit exceeded (30/hour). try again later.'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.invite_code_attempts (user_id) VALUES (v_caller);

  -- 코드로 squad 찾기
  SELECT * INTO v_squad
  FROM public.squads
  WHERE invite_code = upper(p_code)
  LIMIT 1;

  IF v_squad.id IS NULL THEN
    RAISE EXCEPTION 'invalid invite code' USING ERRCODE = 'P0002';
  END IF;

  -- 이미 가입 여부 확인
  SELECT sm.user_id INTO v_existing
  FROM public.squad_members sm
  WHERE sm.squad_id = v_squad.id AND sm.user_id = v_caller
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT v_squad.id::text, 'already_member'::text;
    RETURN;
  END IF;

  -- 가입 (SECURITY DEFINER 로 RLS 우회)
  INSERT INTO public.squad_members (squad_id, user_id, role)
  VALUES (v_squad.id, v_caller, 'member');

  RETURN QUERY SELECT v_squad.id::text, 'joined'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_squad_with_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_squad_with_code(text) TO authenticated;

-- 2. squad_members 의 일반 INSERT 정책 제거
--    (이제 모든 INSERT 는 SECURITY DEFINER RPC 를 통해서만 가능)
DROP POLICY IF EXISTS "Users can join squad as self" ON public.squad_members;
