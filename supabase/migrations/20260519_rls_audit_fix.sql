-- ====================================================================
-- 보안 감사 후속 — RLS 누락 보강
-- 1. match_mercenaries 테이블 RLS 활성화 + 정책 추가
-- 2. match_attendees RLS 활성화 명시적 보장 (idempotent)
-- ====================================================================

-- 1. match_mercenaries — squad 멤버만 조회/등록 가능, 운영자만 삭제
ALTER TABLE public.match_mercenaries ENABLE ROW LEVEL SECURITY;

-- SELECT: 같은 squad 멤버
DROP POLICY IF EXISTS "Squad members can view match mercenaries" ON public.match_mercenaries;
CREATE POLICY "Squad members can view match mercenaries"
  ON public.match_mercenaries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.squad_members sm ON sm.squad_id = m.squad_id
      WHERE m.id = match_mercenaries.match_id
        AND sm.user_id = auth.uid()
    )
  );

-- INSERT: 같은 squad 멤버 누구나 용병 추가 가능
DROP POLICY IF EXISTS "Squad members can insert match mercenaries" ON public.match_mercenaries;
CREATE POLICY "Squad members can insert match mercenaries"
  ON public.match_mercenaries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.squad_members sm ON sm.squad_id = m.squad_id
      WHERE m.id = match_mercenaries.match_id
        AND sm.user_id = auth.uid()
    )
  );

-- DELETE: 같은 squad 멤버 누구나 (용병은 공용 데이터, 잘못 등록 시 누구나 정리 가능)
DROP POLICY IF EXISTS "Squad members can delete match mercenaries" ON public.match_mercenaries;
CREATE POLICY "Squad members can delete match mercenaries"
  ON public.match_mercenaries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.squad_members sm ON sm.squad_id = m.squad_id
      WHERE m.id = match_mercenaries.match_id
        AND sm.user_id = auth.uid()
    )
  );

-- UPDATE 정책 없음 — 이름 수정은 삭제 후 재등록으로 처리

-- 2. match_attendees RLS 명시적 활성화 (혹시 비활성 상태라면 활성화)
ALTER TABLE public.match_attendees ENABLE ROW LEVEL SECURITY;
