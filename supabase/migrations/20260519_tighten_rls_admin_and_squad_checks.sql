-- ====================================================================
-- v2 보안 강화: 운영자 권한 강제 + match_attendees squad 멤버십 검증
-- ====================================================================

-- 1. matches: INSERT를 운영자(owner/admin)만 가능하도록 제한
DROP POLICY IF EXISTS "matches_insert" ON public.matches;
CREATE POLICY "matches_insert" ON public.matches
  FOR INSERT TO authenticated
  WITH CHECK (is_squad_admin(squad_id));

-- 2. match_attendees: INSERT/UPDATE에 squad 멤버십 검증 추가
DROP POLICY IF EXISTS "Users can insert own attendance" ON public.match_attendees;
DROP POLICY IF EXISTS "attendees_insert" ON public.match_attendees;
CREATE POLICY "attendees_insert" ON public.match_attendees
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.squad_members sm ON sm.squad_id = m.squad_id
      WHERE m.id = match_attendees.match_id
        AND sm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own attendance" ON public.match_attendees;
DROP POLICY IF EXISTS "attendees_update" ON public.match_attendees;
CREATE POLICY "attendees_update" ON public.match_attendees
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.squad_members sm ON sm.squad_id = m.squad_id
      WHERE m.id = match_attendees.match_id
        AND sm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own attendance" ON public.match_attendees;
DROP POLICY IF EXISTS "attendees_delete" ON public.match_attendees;
CREATE POLICY "attendees_delete" ON public.match_attendees
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 3. match_comments: UPDATE 정책 추가 (본인 댓글만 수정)
DROP POLICY IF EXISTS "Users can update own match comments" ON public.match_comments;
CREATE POLICY "Users can update own match comments" ON public.match_comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. squad_members UPDATE: admin이 자기 role을 owner로 못 바꾸도록
--    중복 정책 정리 + role 변경은 owner만
DROP POLICY IF EXISTS "Admins can update membership" ON public.squad_members;
DROP POLICY IF EXISTS "squad_members_update_role" ON public.squad_members;
CREATE POLICY "squad_members_update_by_owner" ON public.squad_members
  FOR UPDATE TO authenticated
  USING (
    squad_id IN (SELECT get_my_owned_squad_ids())
  )
  WITH CHECK (
    squad_id IN (SELECT get_my_owned_squad_ids())
  );

-- 5. match_attendees: 중복된 SELECT 정책 정리
DROP POLICY IF EXISTS "Squad members can view attendance" ON public.match_attendees;
-- attendees_select (legacy 호환 포함) 유지
