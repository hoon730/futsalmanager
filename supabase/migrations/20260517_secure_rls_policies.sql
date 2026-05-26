-- ============================================================
-- 보안 강화: 핵심 테이블의 RLS 정책 재작성
-- ============================================================
-- 기존 supabase-setup.sql 의 "Enable all access" 정책은
-- 익명/인증 사용자 모두에게 전권을 주어 사실상 RLS가 무효였음.
-- squad_members 의 가입 여부 + role 을 기준으로 정책을 다시 작성.
-- Supabase Dashboard > SQL Editor 에서 실행.
-- ============================================================


-- 0. 헬퍼 함수 (SECURITY DEFINER로 RLS 재귀 회피)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_squad_member(_squad_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.squad_members
    WHERE squad_id = _squad_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_squad_admin(_squad_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.squad_members
    WHERE squad_id = _squad_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_squad_member(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_squad_admin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_squad_member(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_squad_admin(text) TO authenticated;


-- 1. squads
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Enable all access for squads" ON public.squads;
DROP POLICY IF EXISTS "Squad members can view squad" ON public.squads;
DROP POLICY IF EXISTS "Authenticated can create squad" ON public.squads;
DROP POLICY IF EXISTS "Squad admins can update squad" ON public.squads;
DROP POLICY IF EXISTS "Squad owner can delete squad" ON public.squads;

ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Squad members can view squad"
  ON public.squads
  FOR SELECT
  TO authenticated
  USING (public.is_squad_member(id));

CREATE POLICY "Authenticated can create squad"
  ON public.squads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Squad admins can update squad"
  ON public.squads
  FOR UPDATE
  TO authenticated
  USING (public.is_squad_admin(id))
  WITH CHECK (public.is_squad_admin(id));

CREATE POLICY "Squad owner can delete squad"
  ON public.squads
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);


-- 2. squad_members
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Squad members can view membership" ON public.squad_members;
DROP POLICY IF EXISTS "Users can join squad as self" ON public.squad_members;
DROP POLICY IF EXISTS "Admins can update membership" ON public.squad_members;
DROP POLICY IF EXISTS "Self or admin can delete membership" ON public.squad_members;

ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Squad members can view membership"
  ON public.squad_members
  FOR SELECT
  TO authenticated
  USING (public.is_squad_member(squad_id));

-- 본인 user_id로만 INSERT 가능 (조인 코드/초대 검증은 앱 레벨)
CREATE POLICY "Users can join squad as self"
  ON public.squad_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- role 변경 등은 owner/admin 만
CREATE POLICY "Admins can update membership"
  ON public.squad_members
  FOR UPDATE
  TO authenticated
  USING (public.is_squad_admin(squad_id))
  WITH CHECK (public.is_squad_admin(squad_id));

-- 본인 탈퇴 or owner/admin이 추방
CREATE POLICY "Self or admin can delete membership"
  ON public.squad_members
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_squad_admin(squad_id));


-- 3. members (선수 명단)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Enable all access for members" ON public.members;
DROP POLICY IF EXISTS "Squad members can view roster" ON public.members;
DROP POLICY IF EXISTS "Admins can manage roster" ON public.members;

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Squad members can view roster"
  ON public.members
  FOR SELECT
  TO authenticated
  USING (public.is_squad_member(squad_id));

CREATE POLICY "Admins can manage roster"
  ON public.members
  FOR ALL
  TO authenticated
  USING (public.is_squad_admin(squad_id))
  WITH CHECK (public.is_squad_admin(squad_id));


-- 4. fixed_teams (고정 팀)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Enable all access for fixed_teams" ON public.fixed_teams;
DROP POLICY IF EXISTS "Squad members can view fixed teams" ON public.fixed_teams;
DROP POLICY IF EXISTS "Admins can manage fixed teams" ON public.fixed_teams;

ALTER TABLE public.fixed_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Squad members can view fixed teams"
  ON public.fixed_teams
  FOR SELECT
  TO authenticated
  USING (public.is_squad_member(squad_id));

CREATE POLICY "Admins can manage fixed teams"
  ON public.fixed_teams
  FOR ALL
  TO authenticated
  USING (public.is_squad_admin(squad_id))
  WITH CHECK (public.is_squad_admin(squad_id));


-- 5. divisions (팀 나누기 이력)
-- ------------------------------------------------------------
-- 모든 멤버가 팀 나누기를 저장할 수 있어야 하므로 SELECT/INSERT 는 멤버,
-- 삭제는 admin 만.
DROP POLICY IF EXISTS "Enable all access for divisions" ON public.divisions;
DROP POLICY IF EXISTS "Squad members can view divisions" ON public.divisions;
DROP POLICY IF EXISTS "Squad members can insert divisions" ON public.divisions;
DROP POLICY IF EXISTS "Squad members can update divisions" ON public.divisions;
DROP POLICY IF EXISTS "Admins can delete divisions" ON public.divisions;

ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Squad members can view divisions"
  ON public.divisions
  FOR SELECT
  TO authenticated
  USING (public.is_squad_member(squad_id));

CREATE POLICY "Squad members can insert divisions"
  ON public.divisions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_squad_member(squad_id));

CREATE POLICY "Squad members can update divisions"
  ON public.divisions
  FOR UPDATE
  TO authenticated
  USING (public.is_squad_member(squad_id))
  WITH CHECK (public.is_squad_member(squad_id));

CREATE POLICY "Admins can delete divisions"
  ON public.divisions
  FOR DELETE
  TO authenticated
  USING (public.is_squad_admin(squad_id));


-- 6. teammate_history (자동 누적 이력)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Enable all access for teammate_history" ON public.teammate_history;
DROP POLICY IF EXISTS "Squad members can view teammate history" ON public.teammate_history;
DROP POLICY IF EXISTS "Squad members can write teammate history" ON public.teammate_history;
DROP POLICY IF EXISTS "Admins can delete teammate history" ON public.teammate_history;

ALTER TABLE public.teammate_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Squad members can view teammate history"
  ON public.teammate_history
  FOR SELECT
  TO authenticated
  USING (public.is_squad_member(squad_id));

CREATE POLICY "Squad members can write teammate history"
  ON public.teammate_history
  FOR ALL
  TO authenticated
  USING (public.is_squad_member(squad_id))
  WITH CHECK (public.is_squad_member(squad_id));


-- 7. matches (경기)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Squad members can view matches" ON public.matches;
DROP POLICY IF EXISTS "Admins can manage matches" ON public.matches;

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Squad members can view matches"
  ON public.matches
  FOR SELECT
  TO authenticated
  USING (public.is_squad_member(squad_id));

CREATE POLICY "Admins can manage matches"
  ON public.matches
  FOR ALL
  TO authenticated
  USING (public.is_squad_admin(squad_id))
  WITH CHECK (public.is_squad_admin(squad_id));


-- 8. profiles (사용자 프로필)
-- ------------------------------------------------------------
-- 본인 + 같은 squad 멤버 끼리만 닉네임/아바타 조회 가능.
-- 본인만 자기 프로필 INSERT/UPDATE 가능.
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Squad members can view squadmate profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Squad members can view squadmate profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.squad_members sm_me
      JOIN public.squad_members sm_them
        ON sm_me.squad_id = sm_them.squad_id
      WHERE sm_me.user_id = auth.uid()
        AND sm_them.user_id = profiles.id
    )
  );

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
