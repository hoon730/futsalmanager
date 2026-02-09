import { supabase } from "./supabase";
import type { ISquad, IMember, IFixedTeam, IDivision, ITeammateHistory } from "@/types";

// ====================================
// 스쿼드 동기화
// ====================================

export const syncSquadToSupabase = async (squad: ISquad) => {
  try {
    // 1. 스쿼드 저장
    const { error: squadError } = await supabase
      .from("squads")
      .upsert({
        id: squad.id,
        name: squad.name,
        created_at: squad.createdAt,
      });

    if (squadError) throw squadError;

    // 2. 기존 멤버 ID 조회
    const { data: existingMembers } = await supabase
      .from("members")
      .select("id")
      .eq("squad_id", squad.id);

    const existingIds = new Set((existingMembers || []).map((m) => m.id));
    const currentIds = new Set(squad.members.map((m) => m.id));

    // 3. 삭제할 멤버 (기존에는 있지만 현재에는 없음)
    const toDelete = Array.from(existingIds).filter((id) => !currentIds.has(id));
    if (toDelete.length > 0) {
      await supabase.from("members").delete().in("id", toDelete);
    }

    // 4. 추가/업데이트할 멤버 (upsert로 한 번에 처리)
    if (squad.members.length > 0) {
      const membersData = squad.members.map((m) => ({
        id: m.id,
        squad_id: squad.id,
        name: m.name,
        skill_level: m.skillLevel || 5,
        active: m.active,
        created_at: m.createdAt,
      }));

      const { error: membersError } = await supabase
        .from("members")
        .upsert(membersData);

      if (membersError) throw membersError;
    }

    return { success: true };
  } catch (error) {
    console.error("스쿼드 동기화 실패:", error);
    return { success: false, error };
  }
};

export const loadSquadFromSupabase = async (squadId: string): Promise<ISquad | null> => {
  try {
    // 1. 스쿼드 정보 가져오기
    const { data: squadData, error: squadError } = await supabase
      .from("squads")
      .select("*")
      .eq("id", squadId)
      .single();

    if (squadError || !squadData) return null;

    // 2. 멤버 정보 가져오기
    const { data: membersData, error: membersError } = await supabase
      .from("members")
      .select("*")
      .eq("squad_id", squadId)
      .order("created_at", { ascending: true });

    if (membersError) throw membersError;

    const members: IMember[] = (membersData || []).map((m) => ({
      id: m.id,
      name: m.name,
      skillLevel: m.skill_level,
      active: m.active,
      createdAt: m.created_at,
    }));

    return {
      id: squadData.id,
      name: squadData.name,
      members,
      createdAt: squadData.created_at,
    };
  } catch (error) {
    console.error("스쿼드 로드 실패:", error);
    return null;
  }
};

// 스쿼드 이름으로 검색
export const findSquadByName = async (name: string): Promise<ISquad | null> => {
  try {
    const { data: squadData, error } = await supabase
      .from("squads")
      .select("*")
      .eq("name", name)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !squadData) return null;

    return loadSquadFromSupabase(squadData.id);
  } catch (error) {
    console.error("스쿼드 검색 실패:", error);
    return null;
  }
};

// ====================================
// 고정 팀 동기화
// ====================================

export const syncFixedTeamsToSupabase = async (
  squadId: string,
  fixedTeams: IFixedTeam[]
) => {
  try {
    // 기존 고정 팀 삭제
    await supabase.from("fixed_teams").delete().eq("squad_id", squadId);

    // 새 고정 팀 저장
    if (fixedTeams.length > 0) {
      const teamsData = fixedTeams.map((ft) => ({
        id: ft.id,
        squad_id: squadId,
        player_ids: ft.playerIds || [],
        active: ft.active,
      }));

      const { error } = await supabase.from("fixed_teams").insert(teamsData);
      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error("고정 팀 동기화 실패:", error);
    return { success: false, error };
  }
};

export const loadFixedTeamsFromSupabase = async (
  squadId: string
): Promise<IFixedTeam[]> => {
  try {
    const { data, error } = await supabase
      .from("fixed_teams")
      .select("*")
      .eq("squad_id", squadId);

    if (error) throw error;

    return (data || []).map((ft) => ({
      id: ft.id,
      playerIds: ft.player_ids,
      active: ft.active,
    }));
  } catch (error) {
    console.error("고정 팀 로드 실패:", error);
    return [];
  }
};

// ====================================
// 팀 나누기 이력 동기화
// ====================================

export const syncDivisionToSupabase = async (division: IDivision) => {
  try {
    const { error } = await supabase.from("divisions").insert({
      id: division.id,
      squad_id: division.squadId,
      division_date: division.divisionDate,
      notes: division.notes,
      period: division.period,
      teams: division.teams,
      team_count: division.teamCount,
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("이력 동기화 실패:", error);
    return { success: false, error };
  }
};

export const loadDivisionsFromSupabase = async (
  squadId: string
): Promise<IDivision[]> => {
  try {
    const { data, error } = await supabase
      .from("divisions")
      .select("*")
      .eq("squad_id", squadId)
      .order("division_date", { ascending: false });

    if (error) throw error;

    return (data || []).map((d) => ({
      id: d.id,
      squadId: d.squad_id,
      divisionDate: d.division_date,
      notes: d.notes,
      period: d.period as "전반전" | "후반전",
      teams: d.teams,
      teamCount: d.team_count,
    }));
  } catch (error) {
    console.error("이력 로드 실패:", error);
    return [];
  }
};

export const deleteDivisionFromSupabase = async (divisionId: string) => {
  try {
    const { error } = await supabase
      .from("divisions")
      .delete()
      .eq("id", divisionId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("이력 삭제 실패:", error);
    return { success: false, error };
  }
};

// ====================================
// 팀 메이트 이력 동기화
// ====================================

export const syncTeammateHistoryToSupabase = async (
  squadId: string,
  history: ITeammateHistory
) => {
  try {
    // 기존 이력 삭제
    await supabase.from("teammate_history").delete().eq("squad_id", squadId);

    // 새 이력 저장
    const historyData = Object.entries(history).map(([pair, count]) => ({
      squad_id: squadId,
      player_pair: pair,
      count,
    }));

    if (historyData.length > 0) {
      const { error } = await supabase
        .from("teammate_history")
        .insert(historyData);
      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error("팀 메이트 이력 동기화 실패:", error);
    return { success: false, error };
  }
};

export const loadTeammateHistoryFromSupabase = async (
  squadId: string
): Promise<ITeammateHistory> => {
  try {
    const { data, error } = await supabase
      .from("teammate_history")
      .select("*")
      .eq("squad_id", squadId);

    if (error) throw error;

    const history: ITeammateHistory = {};
    (data || []).forEach((item) => {
      history[item.player_pair] = item.count;
    });

    return history;
  } catch (error) {
    console.error("팀 메이트 이력 로드 실패:", error);
    return {};
  }
};

// ====================================
// 전체 데이터 동기화
// ====================================

export const syncAllDataToSupabase = async (
  squad: ISquad,
  fixedTeams: IFixedTeam[],
  divisions: IDivision[],
  teammateHistory: ITeammateHistory
) => {
  const results = await Promise.all([
    syncSquadToSupabase(squad),
    syncFixedTeamsToSupabase(squad.id, fixedTeams),
    syncTeammateHistoryToSupabase(squad.id, teammateHistory),
  ]);

  // 이력은 개별적으로 동기화 (중복 방지)
  for (const division of divisions) {
    await syncDivisionToSupabase(division);
  }

  const allSuccess = results.every((r) => r.success);
  return { success: allSuccess };
};

export const loadAllDataFromSupabase = async (squadId: string) => {
  const [squad, fixedTeams, divisions, teammateHistory] = await Promise.all([
    loadSquadFromSupabase(squadId),
    loadFixedTeamsFromSupabase(squadId),
    loadDivisionsFromSupabase(squadId),
    loadTeammateHistoryFromSupabase(squadId),
  ]);

  return {
    squad,
    fixedTeams,
    divisions,
    teammateHistory,
  };
};
