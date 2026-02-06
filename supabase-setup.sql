-- ====================================
-- 풋살 팀 나누기 - Supabase 데이터베이스 스키마
-- ====================================

-- 1. 스쿼드 테이블
CREATE TABLE IF NOT EXISTS squads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 멤버 테이블
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  squad_id TEXT NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  skill_level INTEGER DEFAULT 5 CHECK (skill_level >= 1 AND skill_level <= 10),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 고정 팀 테이블
CREATE TABLE IF NOT EXISTS fixed_teams (
  id TEXT PRIMARY KEY,
  squad_id TEXT NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  player_ids TEXT[] NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 팀 나누기 이력 테이블
CREATE TABLE IF NOT EXISTS divisions (
  id TEXT PRIMARY KEY,
  squad_id TEXT NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  division_date TIMESTAMPTZ NOT NULL,
  notes TEXT,
  period TEXT CHECK (period IN ('전반전', '후반전')),
  teams JSONB NOT NULL,
  team_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 팀 메이트 이력 테이블
CREATE TABLE IF NOT EXISTS teammate_history (
  id SERIAL PRIMARY KEY,
  squad_id TEXT NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  player_pair TEXT NOT NULL, -- "id1-id2" 형식
  count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(squad_id, player_pair)
);

-- 6. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_members_squad_id ON members(squad_id);
CREATE INDEX IF NOT EXISTS idx_fixed_teams_squad_id ON fixed_teams(squad_id);
CREATE INDEX IF NOT EXISTS idx_divisions_squad_id ON divisions(squad_id);
CREATE INDEX IF NOT EXISTS idx_divisions_date ON divisions(division_date DESC);
CREATE INDEX IF NOT EXISTS idx_teammate_history_squad_id ON teammate_history(squad_id);

-- 7. updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. 트리거 생성
CREATE TRIGGER update_squads_updated_at
  BEFORE UPDATE ON squads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teammate_history_updated_at
  BEFORE UPDATE ON teammate_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. RLS (Row Level Security) 활성화
ALTER TABLE squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teammate_history ENABLE ROW LEVEL SECURITY;

-- 10. 모든 사용자가 모든 데이터에 접근 가능하도록 정책 설정
-- (같은 스쿼드 이름을 공유하는 팀원끼리 데이터 공유)
CREATE POLICY "Enable all access for squads" ON squads FOR ALL USING (true);
CREATE POLICY "Enable all access for members" ON members FOR ALL USING (true);
CREATE POLICY "Enable all access for fixed_teams" ON fixed_teams FOR ALL USING (true);
CREATE POLICY "Enable all access for divisions" ON divisions FOR ALL USING (true);
CREATE POLICY "Enable all access for teammate_history" ON teammate_history FOR ALL USING (true);

-- ====================================
-- 설정 완료!
-- ====================================
-- 다음 단계:
-- 1. Supabase Dashboard → SQL Editor
-- 2. 이 파일 내용 전체 복사
-- 3. "Run" 클릭하여 실행
-- 4. 성공 메시지 확인
-- ====================================
