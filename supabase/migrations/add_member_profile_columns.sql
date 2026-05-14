-- members 테이블에 포지션·아바타·용병 컬럼 추가
-- 이 마이그레이션을 Supabase SQL Editor에서 실행하세요

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS position_key TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_mercenary BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- 기존 멤버는 skill_level 기본값이 5였으므로, NULL인 경우 3으로 초기화
UPDATE public.members SET skill_level = 3 WHERE skill_level IS NULL;
