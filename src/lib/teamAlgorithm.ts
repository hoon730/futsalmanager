import type { IMember, IFixedTeam, ITeammateHistory } from "@/types";

interface IDivisionResult {
  teams: IMember[][];
}

/**
 * 랜덤 팀 나누기 (제약조건 고려)
 */
export const divideTeamsWithConstraints = async (
  players: IMember[],
  teamCount: number = 2,
  fixedTeams: IFixedTeam[] = [],
  teammateHistory: ITeammateHistory = {}
): Promise<IDivisionResult | null> => {
  if (players.length < teamCount) {
    alert(`최소 ${teamCount}명 이상의 참가자가 필요합니다.`);
    return null;
  }

  console.log("팀 나누기 알고리즘 시작:", {
    참가자: players.map((p) => p.name),
    팀개수: teamCount,
    고정팀수: fixedTeams.length,
    고정팀상세: fixedTeams.map((ft) => ({
      playerIds: ft.playerIds,
      이름들: ft.playerIds?.map(
        (id) => players.find((p) => p.id === id)?.name
      ),
    })),
  });

  const maxAttempts = 1000;
  let bestDivision: IDivisionResult | null = null;
  let bestScore = Infinity;
  let successfulAttempts = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const division = attemptDivision(players, teamCount, fixedTeams);

    if (division) {
      successfulAttempts++;
      const score = calculateDivisionScore(division, teammateHistory);

      if (score < bestScore) {
        bestScore = score;
        bestDivision = division;
      }

      // 완벽한 나누기를 찾으면 즉시 반환
      if (score === 0) {
        break;
      }
    }
  }

  console.log("팀 나누기 결과:", {
    성공한시도: successfulAttempts,
    최고점수: bestScore,
    결과: bestDivision ? "성공" : "실패",
  });

  if (!bestDivision) {
    alert("팀을 나눌 수 없습니다. 고정 설정을 확인해주세요.");
    return null;
  }

  return bestDivision;
};

/**
 * 한 번의 팀 나누기 시도
 */
const attemptDivision = (
  players: IMember[],
  teamCount: number,
  fixedTeams: IFixedTeam[]
): IDivisionResult | null => {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const baseTeamSize = Math.floor(shuffled.length / teamCount);
  const extraPlayers = shuffled.length % teamCount;

  // 팀 배열 초기화
  const teams: IMember[][] = Array.from({ length: teamCount }, () => []);
  const assigned = new Set<string>();

  // 각 팀의 목표 인원 계산
  const teamSizes = teams.map((_, idx) =>
    baseTeamSize + (idx < extraPlayers ? 1 : 0)
  );

  // 1. 고정 그룹 먼저 배치
  for (const group of fixedTeams) {
    if (!group.active || !group.playerIds || group.playerIds.length === 0) {
      continue;
    }

    const groupPlayers = group.playerIds
      .map((id) => shuffled.find((p) => p.id === id))
      .filter((p): p is IMember => p !== undefined && !assigned.has(p.id));

    // 그룹의 모든 인원이 아직 배치되지 않았는지 확인
    if (groupPlayers.length !== group.playerIds.length) {
      console.log("고정 그룹 일부 멤버가 이미 배치됨, 스킵:", group);
      continue;
    }

    console.log("고정 그룹 배치 시도:", {
      그룹크기: groupPlayers.length,
      멤버: groupPlayers.map((p) => p.name),
    });

    // 여유가 있는 팀 찾기
    let placed = false;
    for (let i = 0; i < teams.length; i++) {
      const 현재팀크기 = teams[i].length;
      const 목표크기 = teamSizes[i];

      if (현재팀크기 + groupPlayers.length <= 목표크기) {
        teams[i].push(...groupPlayers);
        groupPlayers.forEach((p) => assigned.add(p.id));
        placed = true;
        console.log(`고정 그룹을 팀 ${i}에 배치 성공`);
        break;
      }
    }

    // 고정 그룹을 배치할 수 없으면 실패
    if (!placed) {
      console.log("고정 그룹 배치 실패, 이번 시도 폐기");
      return null;
    }
  }

  // 2. 나머지 참가자 배치
  for (const player of shuffled) {
    if (assigned.has(player.id)) continue;

    // 가장 적은 인원을 가진 팀 찾기
    const targetTeamIdx = teams.reduce(
      (minIdx, team, idx) => (team.length < teams[minIdx].length ? idx : minIdx),
      0
    );

    teams[targetTeamIdx].push(player);
    assigned.add(player.id);
  }

  return { teams };
};

/**
 * 팀 나누기 점수 계산 (낮을수록 좋음)
 */
const calculateDivisionScore = (
  division: IDivisionResult,
  teammateHistory: ITeammateHistory
): number => {
  let score = 0;

  division.teams.forEach((team) => {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const key = [team[i].id, team[j].id].sort().join("-");
        const count = teammateHistory[key] || 0;

        // 함께한 횟수에 따라 점수 부여 (제곱으로 페널티 증가)
        score += Math.pow(count, 2);
      }
    }
  });

  return score;
};

/**
 * 팀 메이트 이력 업데이트
 */
export const updateTeammateHistory = (
  teams: IMember[][],
  currentHistory: ITeammateHistory
): ITeammateHistory => {
  const newHistory = { ...currentHistory };

  teams.forEach((team) => {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const key = [team[i].id, team[j].id].sort().join("-");
        newHistory[key] = (newHistory[key] || 0) + 1;
      }
    }
  });

  return newHistory;
};
