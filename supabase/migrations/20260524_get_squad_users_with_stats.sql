-- ====================================================================
-- squad 회원 목록 + 출석 통계를 한 번에 조회하는 RPC
-- SettingsPage에서 4개 쿼리를 단일 호출로 대체
-- ====================================================================
-- ⚠️ 버그 수정: 기존 버전은 RETURNS TABLE 컬럼명이 본문의 컬럼명과 충돌해
-- 'column reference "user_id" is ambiguous' (42702) 에러 발생.
-- OUT 파라미터에 `o_` 접두어를 붙여 모호성 제거.
DROP FUNCTION IF EXISTS public.get_squad_users_with_stats(text);

CREATE OR REPLACE FUNCTION public.get_squad_users_with_stats(p_squad_id text)
RETURNS TABLE (
  o_user_id          uuid,
  o_role             text,
  o_username         text,
  o_joined_at        timestamptz,
  o_attended_matches bigint,
  o_total_matches    bigint,
  o_attendance_rate  int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 운영자/관리자만 조회 가능
  IF NOT EXISTS (
    SELECT 1 FROM squad_members sm
    WHERE sm.squad_id = p_squad_id
      AND sm.user_id  = auth.uid()
      AND sm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH members AS (
    SELECT sm.user_id, sm.role, sm.joined_at,
           COALESCE(p.username, '알 수 없음') AS username
    FROM   squad_members sm
    LEFT JOIN profiles p ON p.id = sm.user_id
    WHERE  sm.squad_id = p_squad_id
  ),
  past_matches AS (
    SELECT m.id, m.match_date
    FROM   matches m
    WHERE  m.squad_id = p_squad_id
      AND  m.match_date < now()
  ),
  attendance_stats AS (
    SELECT
      mem.user_id                                            AS uid,
      COUNT(pm.id)                                           AS total_eligible,
      COUNT(CASE WHEN ma.status = 'attending' THEN 1 END)    AS attended
    FROM       members mem
    LEFT JOIN  past_matches pm  ON pm.match_date >= mem.joined_at
    LEFT JOIN  match_attendees ma
               ON ma.match_id = pm.id AND ma.user_id = mem.user_id
    GROUP BY   mem.user_id
  )
  SELECT
    mem.user_id                            AS o_user_id,
    mem.role                               AS o_role,
    mem.username                           AS o_username,
    mem.joined_at                          AS o_joined_at,
    COALESCE(s.attended,      0)::bigint   AS o_attended_matches,
    COALESCE(s.total_eligible, 0)::bigint  AS o_total_matches,
    CASE WHEN COALESCE(s.total_eligible, 0) > 0
         THEN ROUND(
           COALESCE(s.attended, 0)::numeric
           / COALESCE(s.total_eligible, 1) * 100
         )::int
         ELSE 0
    END                                    AS o_attendance_rate
  FROM      members mem
  LEFT JOIN attendance_stats s ON s.uid = mem.user_id
  ORDER BY
    CASE mem.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
    mem.joined_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_squad_users_with_stats(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_squad_users_with_stats(text) TO authenticated;
