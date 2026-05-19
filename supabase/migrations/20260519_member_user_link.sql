-- ====================================================================
-- 선수(member) ↔ user 1:1 연결 강제
-- - members.linked_user_id 컬럼 + 부분 UNIQUE 인덱스
-- - link_my_member / unlink_my_member RPC
-- - 기존 user_metadata.member_id 데이터를 백필
-- ====================================================================

-- 1. 컬럼 추가
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. 부분 UNIQUE 인덱스 (NULL은 중복 허용, 실제 연결된 user만 유일성 강제)
CREATE UNIQUE INDEX IF NOT EXISTS members_linked_user_id_unique
  ON public.members(linked_user_id)
  WHERE linked_user_id IS NOT NULL;

-- 3. 기존 user_metadata.member_id → members.linked_user_id 백필
--    한 user가 여러 member에 metadata 연결되어 있던 비정상 케이스는 첫 번째만 적용
WITH first_link AS (
  SELECT DISTINCT ON (u.id)
    u.id AS user_id,
    (u.raw_user_meta_data ->> 'member_id')::uuid AS member_id
  FROM auth.users u
  WHERE u.raw_user_meta_data ? 'member_id'
    AND length(coalesce(u.raw_user_meta_data ->> 'member_id', '')) > 0
  ORDER BY u.id, u.created_at
)
UPDATE public.members m
   SET linked_user_id = fl.user_id
  FROM first_link fl
 WHERE m.id = fl.member_id
   AND m.linked_user_id IS NULL;

-- 4. 연결 RPC
DROP FUNCTION IF EXISTS public.link_my_member(uuid);
CREATE FUNCTION public.link_my_member(p_member_id uuid)
RETURNS public.members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_link uuid;
  v_member public.members;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다' USING ERRCODE = '42501';
  END IF;

  -- 대상 멤버가 이미 다른 유저에게 연결됐는지 확인
  SELECT linked_user_id INTO v_existing_link
    FROM public.members
   WHERE id = p_member_id;

  IF v_existing_link IS NOT NULL AND v_existing_link != v_user_id THEN
    RAISE EXCEPTION '이미 다른 회원이 연결한 선수입니다' USING ERRCODE = '23505';
  END IF;

  -- 본인이 다른 멤버에 연결돼 있으면 먼저 해제
  UPDATE public.members
     SET linked_user_id = NULL
   WHERE linked_user_id = v_user_id
     AND id != p_member_id;

  -- 새 멤버에 연결
  UPDATE public.members
     SET linked_user_id = v_user_id
   WHERE id = p_member_id
  RETURNING * INTO v_member;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION '선수를 찾을 수 없습니다' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_member;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_my_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_my_member(uuid) TO authenticated;

-- 5. 해제 RPC
DROP FUNCTION IF EXISTS public.unlink_my_member();
CREATE FUNCTION public.unlink_my_member()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다' USING ERRCODE = '42501';
  END IF;

  UPDATE public.members
     SET linked_user_id = NULL
   WHERE linked_user_id = v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.unlink_my_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlink_my_member() TO authenticated;
