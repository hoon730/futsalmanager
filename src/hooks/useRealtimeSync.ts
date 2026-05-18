import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSquadStore } from "@/stores/squadStore";
// getState()를 통해 현재 멤버 수 확인 (hook 외부에서 사용)
import { useDivisionStore } from "@/stores/divisionStore";
import { useFixedTeamStore } from "@/stores/fixedTeamStore";
import { useMatchStore } from "@/stores/matchStore";
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
  const { loadMatches, loadAttendees, loadComments } = useMatchStore();

  useEffect(() => {
    if (!squadId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
          console.log("✨ 스쿼드 업데이트 감지 (다른 기기에서 변경)");
          // 1초 대기 후 업데이트 (자동 업로드 완료 대기)
          await new Promise(resolve => setTimeout(resolve, 1000));
          const updated = await loadSquadFromSupabase(squadId);
          if (!updated) return;

          // 로컬 멤버가 더 많으면 DB 상태로 덮어쓰지 않음
          // (멤버 upsert가 아직 완료되지 않았을 때 데이터 손실 방지)
          const currentMemberCount = useSquadStore.getState().squad?.members.length ?? 0;
          if (updated.members.length < currentMemberCount) {
            console.log(`⚠️ Realtime: DB 멤버(${updated.members.length})가 로컬(${currentMemberCount})보다 적어 업데이트 스킵`);
            return;
          }
          setSquad(updated);
        }
      )
      // members 테이블 Realtime 구독 비활성화 (로컬 변경과 충돌 방지)
      // 멤버 변경은 자동 업로드 후 수동으로 처리됨
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
      // 경기 추가/수정/삭제
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `squad_id=eq.${squadId}`,
        },
        async () => {
          console.log("✨ 경기 업데이트 감지!");
          await loadMatches(squadId);
        }
      )
      // 참석 응답 변경 — match_id로 클라이언트 측 필터
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_attendees" },
        async (payload) => {
          const matchId =
            (payload.new as { match_id?: string })?.match_id ??
            (payload.old as { match_id?: string })?.match_id;
          if (!matchId) return;
          if (!useMatchStore.getState().matches.some((m) => m.id === matchId)) return;
          console.log("✨ 출석 업데이트 감지:", matchId);
          await loadAttendees(matchId);
        }
      )
      // 댓글 변경 — match_id로 클라이언트 측 필터
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_comments" },
        async (payload) => {
          const matchId =
            (payload.new as { match_id?: string })?.match_id ??
            (payload.old as { match_id?: string })?.match_id;
          if (!matchId) return;
          if (!useMatchStore.getState().matches.some((m) => m.id === matchId)) return;
          console.log("✨ 댓글 업데이트 감지:", matchId);
          await loadComments(matchId);
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
  }, [squadId, setSquad, setDivisionHistory, setFixedTeams, updateTeammateHistory, loadMatches, loadAttendees, loadComments]);

  return { isConnected };
};
