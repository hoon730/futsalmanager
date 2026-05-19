-- ====================================================================
-- 내 선수(연결된 members 행) 이름/포지션 수정 RPC
-- - auth.uid() 와 연결된 user_metadata.member_id 를 통해 본인 행만 수정
-- - members.id 가 text 타입이므로 v_member_id 도 text 로 통일
-- - SECURITY DEFINER 로 RLS 회피 (내부에서 권한 검증)
-- ====================================================================

DROP FUNCTION IF EXISTS public.update_my_linked_member(text, text);

CREATE FUNCTION public.update_my_linked_member(
  p_name text,
  p_position_key text
)
RETURNS public.members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_member_id text;
  v_member public.members;
  v_trimmed text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다' USING ERRCODE = '42501';
  END IF;

  v_trimmed := trim(coalesce(p_name, ''));
  IF length(v_trimmed) = 0 THEN
    RAISE EXCEPTION '이름을 입력해주세요' USING ERRCODE = '22023';
  END IF;

  -- 우선 members.linked_user_id 로 본인 행 찾기 (1:1 강제 후 권장 경로)
  SELECT id INTO v_member_id
    FROM public.members
   WHERE linked_user_id = v_user_id
   LIMIT 1;

  -- 폴백: user_metadata.member_id (백필 직전 호출 등 호환)
  IF v_member_id IS NULL THEN
    SELECT raw_user_meta_data ->> 'member_id'
      INTO v_member_id
      FROM auth.users
     WHERE id = v_user_id;
  END IF;

  IF v_member_id IS NULL OR length(v_member_id) = 0 THEN
    RAISE EXCEPTION '연결된 선수가 없습니다' USING ERRCODE = '42501';
  END IF;

  -- 포지션 화이트리스트 검증
  IF p_position_key IS NOT NULL AND p_position_key NOT IN ('GK', 'DF', 'MF', 'FW') THEN
    RAISE EXCEPTION '잘못된 포지션입니다' USING ERRCODE = '22023';
  END IF;

  UPDATE public.members
     SET name = v_trimmed,
         position_key = p_position_key
   WHERE id = v_member_id
  RETURNING * INTO v_member;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION '연결된 선수를 찾을 수 없습니다' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_member;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_my_linked_member(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_linked_member(text, text) TO authenticated;
