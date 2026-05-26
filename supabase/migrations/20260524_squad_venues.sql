-- ====================================================================
-- 동호회 즐겨찾기 장소 (squad_venues)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.squad_venues (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  squad_id   text        NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  address    text,
  created_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 동호회 멤버는 읽기 가능
CREATE POLICY "squad_venues_select" ON public.squad_venues
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_id = squad_venues.squad_id
        AND user_id = auth.uid()
    )
  );

-- owner / admin 만 추가 가능
CREATE POLICY "squad_venues_insert" ON public.squad_venues
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_id = squad_venues.squad_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- owner / admin 만 삭제 가능
CREATE POLICY "squad_venues_delete" ON public.squad_venues
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_id = squad_venues.squad_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

ALTER TABLE public.squad_venues ENABLE ROW LEVEL SECURITY;
