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
        // 유저가 속한 가장 최근 동호회 조회
        const { data } = await supabase
          .from("squad_members")
          .select("squad_id")
          .eq("user_id", userId)
          .order("joined_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!data) {
          // 가입된 동호회 없음 → ClubSetupPage로 이동 (squad=null 유지)
          setIsLoading(false);
          return;
        }

        const [fullSquad, fixedTeams, divisions, history] = await Promise.all([
          loadSquadFromSupabase(data.squad_id),
          loadFixedTeamsFromSupabase(data.squad_id),
          loadDivisionsFromSupabase(data.squad_id),
          loadTeammateHistoryFromSupabase(data.squad_id),
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
