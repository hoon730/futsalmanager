-- 같은 경기에 동일 이름 용병 중복 등록 방지
-- (클라이언트 캐시 체크만으로는 동시 등록 시 누설됨)
ALTER TABLE public.match_mercenaries
  ADD CONSTRAINT match_mercenaries_match_id_name_key UNIQUE (match_id, name);
