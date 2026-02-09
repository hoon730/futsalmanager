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

    // 모든 테이블을 하나의 채널로 통합
    const channel = supabase
      .channel(`squad_all:${squadId}`)
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
        console.log(`📡 Realtime 상태: ${status}`);
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          console.log("✅ 모든 Realtime 연결 완료");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setIsConnected(false);
          console.error("❌ Realtime 연결 실패:", status);
        }
      });

    // 정리 함수
    return () => {
      console.log("🔌 Realtime 구독 해제");
      channel.unsubscribe();
      setIsConnected(false);
    };
  }, [squadId, setSquad, setDivisionHistory, setFixedTeams, updateTeammateHistory]);

  return { isConnected };
};
