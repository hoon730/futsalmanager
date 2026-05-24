import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSquadStore } from "@/stores/squadStore";
import { useDivisionStore } from "@/stores/divisionStore";
import { useFixedTeamStore } from "@/stores/fixedTeamStore";
import {
  loadSquadFromSupabase,
  loadFixedTeamsFromSupabase,
  loadDivisionsFromSupabase,
  loadTeammateHistoryFromSupabase,
} from "@/lib/supabaseSync";

// 로그인한 유저의 소속 동호회 데이터를 로드
export const useAuthSquadLoad = (userId: string | null | undefined) => {
  const [isLoading, setIsLoading] = useState(!!userId);
  const { squad, setSquad } = useSquadStore();
  const { setDivisionHistory, updateTeammateHistory } = useDivisionStore();
  const { setFixedTeams } = useFixedTeamStore();

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    if (squad?.id) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      try {
        // 유저가 속한 모든 동호회 조회
        const { data: memberships } = await supabase
          .from("squad_members")
          .select("squad_id")
          .eq("user_id", userId)
          .order("joined_at", { ascending: false });

        if (!memberships || memberships.length === 0) {
          // 가입된 동호회 없음 → ClubSetupPage로 이동 (squad=null 유지)
          setIsLoading(false);
          return;
        }

        if (memberships.length > 1) {
          // 동호회가 여러 개 → ClubSetupPage에서 직접 선택하게 함 (squad=null 유지)
          setIsLoading(false);
          return;
        }

        // 동호회가 정확히 1개인 경우만 자동 진입
        const [fullSquad, fixedTeams, divisions, history] = await Promise.all([
          loadSquadFromSupabase(memberships[0].squad_id),
          loadFixedTeamsFromSupabase(memberships[0].squad_id),
          loadDivisionsFromSupabase(memberships[0].squad_id),
          loadTeammateHistoryFromSupabase(memberships[0].squad_id),
        ]);

        if (fullSquad) {
          setSquad(fullSquad);
          setFixedTeams(fixedTeams);
          setDivisionHistory(divisions);
          updateTeammateHistory(history);
        }
      } catch (e) {
        console.error("동호회 데이터 로드 실패:", e);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { isLoading };
};
