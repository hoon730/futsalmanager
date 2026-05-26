-- ====================================================================
-- 동호회 단위 용병 풀 (squad_mercenaries)
-- ====================================================================
-- 기존 DivisionPage 의 localStorage('mercenaries') 를 DB 로 일원화.
-- 동호회 전체가 같은 용병 명단을 공유하고, 매치별 참석 기록은
-- 기존 match_mercenaries 테이블이 계속 담당.
--
-- 정책:
--   - SELECT : squad 멤버 모두
--   - INSERT / DELETE / UPDATE : owner / admin 만 (squad_venues 와 동일 패턴)
--   - 동호회 내 이름 중복 방지: UNIQUE (squad_id, name)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.squad_mercenaries (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  squad_id   text        NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  created_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (squad_id, name)
);

CREATE INDEX IF NOT EXISTS squad_mercenaries_squad_id_idx
  ON public.squad_mercenaries (squad_id);

ALTER TABLE public.squad_mercenaries ENABLE ROW LEVEL SECURITY;

-- 동호회 멤버는 읽기 가능
DROP POLICY IF EXISTS "squad_mercenaries_select" ON public.squad_mercenaries;
CREATE POLICY "squad_mercenaries_select" ON public.squad_mercenaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_id = squad_mercenaries.squad_id
        AND user_id = auth.uid()
    )
  );

-- owner / admin 만 추가 가능
DROP POLICY IF EXISTS "squad_mercenaries_insert" ON public.squad_mercenaries;
CREATE POLICY "squad_mercenaries_insert" ON public.squad_mercenaries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_id = squad_mercenaries.squad_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- owner / admin 만 삭제 가능
DROP POLICY IF EXISTS "squad_mercenaries_delete" ON public.squad_mercenaries;
CREATE POLICY "squad_mercenaries_delete" ON public.squad_mercenaries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_id = squad_mercenaries.squad_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );
