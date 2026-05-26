-- ====================================================================
-- squad 생성 트랜잭션화 + 초대 코드 재생성 RPC
-- ====================================================================

-- 1. squad 생성 + owner squad_member 단일 트랜잭션
--    둘 중 하나라도 실패하면 전체 롤백 → 고아 squad 방지
CREATE OR REPLACE FUNCTION public.create_squad_with_owner(
  p_squad_id text,
  p_name text,
  p_description text DEFAULT NULL
)
RETURNS public.squads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_squad public.squads;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION '동호회 이름을 입력해주세요' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.squads (id, name, description, owner_id)
  VALUES (p_squad_id, p_name, p_description, v_user_id)
  RETURNING * INTO v_squad;

  INSERT INTO public.squad_members (squad_id, user_id, role)
  VALUES (v_squad.id, v_user_id, 'owner');

  RETURN v_squad;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_squad_with_owner(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_squad_with_owner(text, text, text) TO authenticated;

-- 2. 초대 코드 재생성 — 유니크 보장 + admin 권한 강제
CREATE OR REPLACE FUNCTION public.regenerate_invite_code(p_squad_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_new_code text;
  v_attempts int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.squad_members
    WHERE squad_id = p_squad_id
      AND user_id = v_user_id
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION '운영자만 초대 코드를 재생성할 수 있습니다' USING ERRCODE = '42501';
  END IF;

  LOOP
    v_new_code := upper(substring(replace(gen_random_uuid()::text, '-', '') for 6));

    BEGIN
      UPDATE public.squads
      SET invite_code = v_new_code
      WHERE id = p_squad_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_attempts := v_attempts + 1;
      IF v_attempts >= 10 THEN
        RAISE EXCEPTION '코드 생성 실패 — 잠시 후 다시 시도해주세요';
      END IF;
    END;
  END LOOP;

  RETURN v_new_code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.regenerate_invite_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regenerate_invite_code(text) TO authenticated;
