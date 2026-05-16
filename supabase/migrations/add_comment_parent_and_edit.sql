-- 대댓글을 위한 parent_id 컬럼 추가
ALTER TABLE public.match_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.match_comments(id) ON DELETE CASCADE;

-- 수정 일시 컬럼 추가
ALTER TABLE public.match_comments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;
