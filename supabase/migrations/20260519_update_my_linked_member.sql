-- ====================================================================
-- 내 선수(연결된 members 행) 이름/포지션 수정 RPC
-- - auth.uid()와 연결된 user_metadata.member_id를 통해 본인 행만 수정
-- - SECURITY DEFINER로 RLS 회피 (내부에서 권한 검증)
-- - 이전 harden_definer_functions.sql 의 REVOKE FROM anon 와 호환 시그니처 사용
-- ====================================================================

CREATE OR REPLACE FUNCTION public.update_my_linked_member(
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
  v_member_id uuid;
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

  -- user_metadata 에서 연결된 member_id 조회
  SELECT (raw_user_meta_data ->> 'member_id')::uuid
    INTO v_member_id
    FROM auth.users
   WHERE id = v_user_id;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION '연결된 선수가 없습니다' USING ERRCODE = '42501';
  END IF;

  -- 포지션 화이트리스트 검증
  IF p_position_key IS NOT NULL AND p_position_key NOT IN ('GK', 'DF', 'MF', 'FW') THEN
    RAISE EXCEPTION '잘못된 포지션입니다' USING ERRCODE = '22023';
  END IF;

  -- 본인이 연결된 멤버만 수정
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
