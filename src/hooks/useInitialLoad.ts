import { useEffect, useState } from "react";
import { useSquadStore } from "@/stores/squadStore";
import { useDivisionStore } from "@/stores/divisionStore";
import { useFixedTeamStore } from "@/stores/fixedTeamStore";
import {
  findSquadByName,
  loadSquadFromSupabase,
  loadFixedTeamsFromSupabase,
  loadDivisionsFromSupabase,
  loadTeammateHistoryFromSupabase,
  syncSquadToSupabase,
} from "@/lib/supabaseSync";
import type { ISquad } from "@/types";

const DEFAULT_SQUAD_NAME = "내 스쿼드";

/**
 * 앱 초기 로드 훅
 * - Supabase에서 기본 스쿼드 데이터 로드
 * - 없으면 새로 생성
 */
export const useInitialLoad = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setErrorState] = useState<string | null>(null);
  const { setSquad, setLoading, setError } = useSquadStore();
  const { setDivisionHistory, updateTeammateHistory } = useDivisionStore();
  const { setFixedTeams } = useFixedTeamStore();

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        console.log("🔄 초기 데이터 로드 시작...");

        // 1. 기본 스쿼드 찾기
        let squad = await findSquadByName(DEFAULT_SQUAD_NAME);

        // 2. 없으면 새로 생성
        if (!squad) {
          console.log("📝 기본 스쿼드 생성...");
          const newSquad: ISquad = {
            id: Date.now().toString(),
            name: DEFAULT_SQUAD_NAME,
            members: [],
            createdAt: new Date().toISOString(),
          };

          const result = await syncSquadToSupabase(newSquad);
          if (result.success) {
            squad = newSquad;
            console.log("✅ 기본 스쿼드 생성 완료");
          } else {
            throw new Error("스쿼드 생성 실패");
          }
        } else {
          console.log("✅ 기존 스쿼드 로드 완료");
        }

        // 3. 스쿼드 상세 데이터 로드
        if (squad) {
          const fullSquad = await loadSquadFromSupabase(squad.id);
          if (fullSquad) {
            setSquad(fullSquad);

            // 4. 관련 데이터 로드
            const [fixedTeams, divisions, history] = await Promise.all([
              loadFixedTeamsFromSupabase(squad.id),
              loadDivisionsFromSupabase(squad.id),
              loadTeammateHistoryFromSupabase(squad.id),
            ]);

            setFixedTeams(fixedTeams);
            setDivisionHistory(divisions);
            updateTeammateHistory(history);

            console.log("✅ 모든 데이터 로드 완료");
            console.log(`  - 멤버: ${fullSquad.members.length}명`);
            console.log(`  - 고정 팀: ${fixedTeams.length}개`);
            console.log(`  - 이력: ${divisions.length}건`);
          }
        }

        setError(null);
        setErrorState(null);
      } catch (error) {
        console.error("❌ 초기 데이터 로드 실패:", error);
        const errorMsg = error instanceof Error ? error.message : "데이터 로드 실패";
        setError(errorMsg);
        setErrorState(errorMsg);

        // 실패해도 빈 스쿼드 생성
        setSquad({
          id: Date.now().toString(),
          name: DEFAULT_SQUAD_NAME,
          members: [],
          createdAt: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [
    setSquad,
    setFixedTeams,
    setDivisionHistory,
    updateTeammateHistory,
    setLoading,
    setError,
  ]);

  return { isLoading, error };
};
