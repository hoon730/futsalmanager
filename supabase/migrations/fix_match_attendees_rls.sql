-- match_attendees RLS 정책 수정
-- 기존 DELETE 정책이 없거나 막혀있을 경우 UPDATE 방식으로 대체하므로
-- UPDATE 권한을 본인 row에 대해 허용합니다.

-- 기존 정책 삭제 (있는 경우)
DROP POLICY IF EXISTS "Users can delete own attendance" ON public.match_attendees;
DROP POLICY IF EXISTS "Users can update own attendance" ON public.match_attendees;

-- UPDATE 정책: 본인의 참석 상태를 변경 가능
CREATE POLICY "Users can update own attendance"
  ON public.match_attendees
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INSERT 정책 (없는 경우 추가)
DROP POLICY IF EXISTS "Users can insert own attendance" ON public.match_attendees;
CREATE POLICY "Users can insert own attendance"
  ON public.match_attendees
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- SELECT 정책: 같은 squad 멤버면 모두 조회 가능
DROP POLICY IF EXISTS "Squad members can view attendance" ON public.match_attendees;
CREATE POLICY "Squad members can view attendance"
  ON public.match_attendees
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.squad_members sm ON sm.squad_id = m.squad_id
      WHERE m.id = match_attendees.match_id
        AND sm.user_id = auth.uid()
    )
  );
