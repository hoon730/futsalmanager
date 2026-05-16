-- 1. match_attendees 상태값 확장 (pending, waitlist 추가)
ALTER TABLE public.match_attendees
  DROP CONSTRAINT IF EXISTS match_attendees_status_check;

ALTER TABLE public.match_attendees
  ADD CONSTRAINT match_attendees_status_check
  CHECK (status IN ('attending', 'absent', 'pending', 'waitlist'));

-- 2. match_comments 테이블 생성
CREATE TABLE IF NOT EXISTS public.match_comments (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id   uuid        NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id),
  content    text        NOT NULL CHECK (char_length(content) > 0),
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.match_comments ENABLE ROW LEVEL SECURITY;

-- 3. match_comments RLS 정책

-- SELECT: 같은 squad 멤버면 조회 가능
CREATE POLICY "Squad members can view match comments"
  ON public.match_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.squad_members sm ON sm.squad_id = m.squad_id
      WHERE m.id = match_comments.match_id
        AND sm.user_id = auth.uid()
    )
  );

-- INSERT: 본인 user_id + squad 멤버만 작성 가능
CREATE POLICY "Squad members can insert match comments"
  ON public.match_comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.squad_members sm ON sm.squad_id = m.squad_id
      WHERE m.id = match_comments.match_id
        AND sm.user_id = auth.uid()
    )
  );

-- DELETE: 본인 댓글만 삭제 가능
CREATE POLICY "Users can delete own match comments"
  ON public.match_comments
  FOR DELETE
  USING (auth.uid() = user_id);
