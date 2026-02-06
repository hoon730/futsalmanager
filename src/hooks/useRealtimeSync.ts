import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSquadStore } from "@/stores/squadStore";
import { useDivisionStore } from "@/stores/divisionStore";
import { useFixedTeamStore } from "@/stores/fixedTeamStore";
import {
  loadSquadFromSupabase,
  loadDivisionsFromSupabase,
  loadFixedTeamsFromSupabase,
  loadTeammateHistoryFromSupabase,
} from "@/lib/supabaseSync";

export const useRealtimeSync = (squadId: string | null) => {
  const [isConnected, setIsConnected] = useState(false);
  const { setSquad } = useSquadStore();
  const { setDivisionHistory, updateTeammateHistory } = useDivisionStore();
  const { setFixedTeams } = useFixedTeamStore();

  useEffect(() => {
    if (!squadId) {
      setIsConnected(false);
      return;
    }

    console.log(`🔄 Realtime 구독 시작: ${squadId}`);

    // 1. 스쿼드 & 멤버 변경 감지
    const squadChannel = supabase
      .channel(`squad:${squadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "squads",
          filter: `id=eq.${squadId}`,
        },
        async () => {
          console.log("✨ 스쿼드 업데이트 감지!");
          const updated = await loadSquadFromSupabase(squadId);
          if (updated) setSquad(updated);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "members",
          filter: `squad_id=eq.${squadId}`,
        },
        async () => {
          console.log("✨ 멤버 업데이트 감지!");
          const updated = await loadSquadFromSupabase(squadId);
          if (updated) setSquad(updated);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          console.log("✅ 스쿼드 Realtime 연결 완료");
        }
      });

    // 2. 고정 팀 변경 감지
    const fixedTeamChannel = supabase
      .channel(`fixed_teams:${squadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fixed_teams",
          filter: `squad_id=eq.${squadId}`,
        },
        async () => {
          console.log("✨ 고정 팀 업데이트 감지!");
          const teams = await loadFixedTeamsFromSupabase(squadId);
          setFixedTeams(teams);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ 고정 팀 Realtime 연결 완료");
        }
      });

    // 3. 팀 나누기 이력 변경 감지
    const divisionChannel = supabase
      .channel(`divisions:${squadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "divisions",
          filter: `squad_id=eq.${squadId}`,
        },
        async () => {
          console.log("✨ 이력 업데이트 감지!");
          const divisions = await loadDivisionsFromSupabase(squadId);
          setDivisionHistory(divisions);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ 이력 Realtime 연결 완료");
        }
      });

    // 4. 팀 메이트 이력 변경 감지
    const historyChannel = supabase
      .channel(`teammate_history:${squadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teammate_history",
          filter: `squad_id=eq.${squadId}`,
        },
        async () => {
          console.log("✨ 팀 메이트 이력 업데이트 감지!");
          const history = await loadTeammateHistoryFromSupabase(squadId);
          updateTeammateHistory(history);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ 팀 메이트 이력 Realtime 연결 완료");
        }
      });

    // 정리 함수
    return () => {
      console.log("🔌 Realtime 구독 해제");
      squadChannel.unsubscribe();
      fixedTeamChannel.unsubscribe();
      divisionChannel.unsubscribe();
      historyChannel.unsubscribe();
      setIsConnected(false);
    };
  }, [squadId, setSquad, setDivisionHistory, setFixedTeams, updateTeammateHistory]);

  return { isConnected };
};
