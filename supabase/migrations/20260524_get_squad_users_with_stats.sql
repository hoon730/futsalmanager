-- ====================================================================
-- squad 회원 목록 + 출석 통계를 한 번에 조회하는 RPC
-- SettingsPage에서 4개 쿼리를 단일 호출로 대체
-- ====================================================================
CREATE OR REPLACE FUNCTION public.get_squad_users_with_stats(p_squad_id text)
RETURNS TABLE (
  user_id       uuid,
  role          text,
  username      text,
  joined_at     timestamptz,
  attended_matches bigint,
  total_matches    bigint,
  attendance_rate  int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 운영자/관리자만 조회 가능
  IF NOT EXISTS (
    SELECT 1 FROM squad_members
    WHERE squad_id = p_squad_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
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
    SELECT id, match_date
    FROM   matches
    WHERE  squad_id = p_squad_id
      AND  match_date < now()
  ),
  attendance_stats AS (
    SELECT
      m.user_id,
      COUNT(pm.id)                                              AS total_eligible,
      COUNT(CASE WHEN ma.status = 'attending' THEN 1 END)      AS attended
    FROM       members m
    LEFT JOIN  past_matches pm ON pm.match_date >= m.joined_at
    LEFT JOIN  match_attendees ma
               ON ma.match_id = pm.id AND ma.user_id = m.user_id
    GROUP BY   m.user_id
  )
  SELECT
    m.user_id,
    m.role,
    m.username,
    m.joined_at,
    COALESCE(s.attended,      0) AS attended_matches,
    COALESCE(s.total_eligible, 0) AS total_matches,
    CASE WHEN COALESCE(s.total_eligible, 0) > 0
         THEN ROUND(
           COALESCE(s.attended, 0)::numeric
           / COALESCE(s.total_eligible, 1) * 100
         )::int
         ELSE 0
    END AS attendance_rate
  FROM      members m
  LEFT JOIN attendance_stats s ON s.user_id = m.user_id
  ORDER BY
    CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
    m.joined_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_squad_users_with_stats(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_squad_users_with_stats(text) TO authenticated;
