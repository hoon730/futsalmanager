import { useState } from "react";
import { Card, Button } from "@/components/ui";
import { ParticipantSelector } from "@/components/participant";
import { TeamCountSelector, TeamCards } from "@/components/team";
import { useSquadStore } from "@/stores/squadStore";
import { useDivisionStore } from "@/stores/divisionStore";
import { useFixedTeamStore } from "@/stores/fixedTeamStore";
import { divideTeamsWithConstraints, updateTeammateHistory } from "@/lib/teamAlgorithm";
import type { IMember, IDivision } from "@/types";

const DivisionPage = () => {
  const { squad, selectedParticipants } = useSquadStore();
  const { currentDivision, setCurrentDivision, teammateHistory, saveDivision, updateTeammateHistory: updateHistory } =
    useDivisionStore();
  const { fixedTeams } = useFixedTeamStore();

  const [showTeamCountModal, setShowTeamCountModal] = useState(false);

  const handleDivideTeams = async (teamCount: number) => {
    if (!squad || selectedParticipants.length < teamCount) {
      alert(`최소 ${teamCount}명 이상 선택해주세요`);
      return;
    }

    const activePlayers: IMember[] = selectedParticipants
      .map((id) => squad.members.find((m) => m.id === id))
      .filter((m): m is IMember => m !== undefined);

    const result = await divideTeamsWithConstraints(
      activePlayers,
      teamCount,
      fixedTeams,
      teammateHistory
    );

    if (result) {
      const division: IDivision = {
        id: Date.now().toString(),
        squadId: squad.id,
        divisionDate: new Date().toISOString(),
        period: "전반전",
        teams: result.teams,
        teamCount,
      };

      setCurrentDivision(division);
    }
  };

  const handleSave = (period: "전반전" | "후반전") => {
    if (!currentDivision) return;

    const savedDivision: IDivision = {
      ...currentDivision,
      id: Date.now().toString(),
      period,
      notes: `${new Date().toLocaleDateString("ko-KR")} ${period}`,
    };

    saveDivision(savedDivision);

    // 팀 메이트 이력 업데이트
    const newHistory = updateTeammateHistory(currentDivision.teams, teammateHistory);
    updateHistory(newHistory);

    alert(`${period} 저장 완료!`);
  };

  const handleReshuffle = () => {
    if (currentDivision) {
      handleDivideTeams(currentDivision.teamCount);
    }
  };

  return (
    <div className="space-y-6">
      <Card title="오늘 참가자 선택">
        <ParticipantSelector />
      </Card>

      <Card title="팀 나누기">
        {!currentDivision ? (
          <div className="text-center">
            <p className="mb-6 text-gray-400">
              참가자를 선택하고 팀 나누기 버튼을 눌러주세요
            </p>
            <Button
              onClick={() => setShowTeamCountModal(true)}
              disabled={selectedParticipants.length < 2}
              className="w-full"
            >
              팀 나누기
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <TeamCards teams={currentDivision.teams} />

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => handleSave("전반전")}
                className="bg-[#00ff41] text-black hover:bg-[#00ff41]/90"
              >
                전반전 저장
              </Button>
              <Button
                onClick={() => handleSave("후반전")}
                className="bg-[#ff6b6b] text-white hover:bg-[#ff6b6b]/90"
              >
                후반전 저장
              </Button>
            </div>

            <Button
              variant="secondary"
              onClick={handleReshuffle}
              className="w-full"
            >
              다시 섞기
            </Button>
          </div>
        )}
      </Card>

      <TeamCountSelector
        isOpen={showTeamCountModal}
        onClose={() => setShowTeamCountModal(false)}
        onSelect={handleDivideTeams}
      />
    </div>
  );
};

export default DivisionPage;
