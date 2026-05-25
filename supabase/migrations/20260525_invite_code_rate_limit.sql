-- ====================================================================
-- 초대 코드 brute force 방어: 사용자당 시간당 호출 횟수 제한
-- ====================================================================
-- 6자리 영문/숫자 코드는 36^6 ≈ 22억 가지로 분포 자체는 충분하지만,
-- 별도 제한이 없으면 자동화된 시도로 가입 가능한 squad 노출 위험.
-- → 사용자당 60분 내 30회 시도 초과 시 RPC 가 에러로 거절.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.invite_code_attempts (
  id           bigserial   PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS invite_code_attempts_user_time_idx
  ON public.invite_code_attempts (user_id, attempted_at);

ALTER TABLE public.invite_code_attempts ENABLE ROW LEVEL SECURITY;
-- 일반 사용자는 직접 접근 불가 — RPC 만 사용
REVOKE ALL ON public.invite_code_attempts FROM PUBLIC;
REVOKE ALL ON public.invite_code_attempts FROM authenticated;

-- 기존 RPC 교체 (시그니처 유지, 본문에 rate limit 로직 추가)
CREATE OR REPLACE FUNCTION public.find_squad_by_invite_code(p_code text)
RETURNS TABLE(id text, name text, owner_id uuid, invite_code text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_recent_count int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다' USING ERRCODE = '42501';
  END IF;

  -- 24시간 지난 시도 cleanup (DELETE 비용 ~0, 별도 cron 불필요)
  DELETE FROM public.invite_code_attempts
  WHERE attempted_at < now() - interval '24 hours';

  -- 최근 1시간 시도 횟수
  SELECT count(*) INTO v_recent_count
  FROM public.invite_code_attempts
  WHERE user_id = v_caller
    AND attempted_at > now() - interval '1 hour';

  IF v_recent_count >= 30 THEN
    RAISE EXCEPTION '시간당 시도 횟수를 초과했습니다 (30회). 잠시 후 다시 시도해주세요.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 시도 기록
  INSERT INTO public.invite_code_attempts (user_id) VALUES (v_caller);

  RETURN QUERY
  SELECT s.id, s.name, s.owner_id, s.invite_code, s.created_at
  FROM public.squads s
  WHERE s.invite_code = upper(p_code)
  LIMIT 1;
END;
$$;
