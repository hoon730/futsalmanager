import { useEffect, useRef } from "react";
import { useSquadStore } from "@/stores/squadStore";
import { useDivisionStore } from "@/stores/divisionStore";
import { useFixedTeamStore } from "@/stores/fixedTeamStore";
import {
  syncSquadToSupabase,
  syncFixedTeamsToSupabase,
  syncDivisionToSupabase,
  syncTeammateHistoryToSupabase,
} from "@/lib/supabaseSync";
import type { ISquad, IFixedTeam, IDivision } from "@/types";

/**
 * 자동 동기화 훅
 * - 데이터 변경 시 자동으로 Supabase에 업로드
 */
export const useAutoSync = () => {
  const { squad } = useSquadStore();
  const { fixedTeams } = useFixedTeamStore();
  const { divisionHistory, teammateHistory } = useDivisionStore();

  // 이전 값 추적 (무한 루프 방지)
  const prevSquadRef = useRef<ISquad | null>(null);
  const prevFixedTeamsRef = useRef<IFixedTeam[]>([]);
  const prevDivisionHistoryRef = useRef<IDivision[]>([]);

  // 스쿼드 변경 시 자동 업로드
  useEffect(() => {
    if (!squad) return;

    const squadChanged =
      JSON.stringify(prevSquadRef.current) !== JSON.stringify(squad);

    if (squadChanged && prevSquadRef.current !== null) {
      console.log("📤 스쿼드 자동 업로드...");
      syncSquadToSupabase(squad);
    }

    prevSquadRef.current = squad;
  }, [squad]);

  // 고정 팀 변경 시 자동 업로드
  useEffect(() => {
    if (!squad?.id) return;

    const teamsChanged =
      JSON.stringify(prevFixedTeamsRef.current) !== JSON.stringify(fixedTeams);

    if (teamsChanged && prevFixedTeamsRef.current.length > 0) {
      console.log("📤 고정 팀 자동 업로드...");
      syncFixedTeamsToSupabase(squad.id, fixedTeams);
    }

    prevFixedTeamsRef.current = fixedTeams;
  }, [fixedTeams, squad?.id]);

  // 이력 변경 시 자동 업로드
  useEffect(() => {
    if (!squad?.id) return;

    const historyChanged =
      JSON.stringify(prevDivisionHistoryRef.current) !==
      JSON.stringify(divisionHistory);

    if (historyChanged && prevDivisionHistoryRef.current.length > 0) {
      // 새로 추가된 이력만 업로드
      const newDivisions = divisionHistory.filter(
        (d) => !prevDivisionHistoryRef.current.find((prev) => prev.id === d.id)
      );

      if (newDivisions.length > 0) {
        console.log(`📤 새 이력 ${newDivisions.length}건 자동 업로드...`);
        newDivisions.forEach((division) => {
          syncDivisionToSupabase(division);
        });
      }
    }

    prevDivisionHistoryRef.current = divisionHistory;
  }, [divisionHistory, squad?.id]);

  // 팀 메이트 이력 변경 시 자동 업로드
  useEffect(() => {
    if (!squad?.id || Object.keys(teammateHistory).length === 0) return;

    console.log("📤 팀 메이트 이력 자동 업로드...");
    syncTeammateHistoryToSupabase(squad.id, teammateHistory);
  }, [teammateHistory, squad?.id]);
};
