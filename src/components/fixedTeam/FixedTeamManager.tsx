import { useState } from "react";
import type { FormEvent } from "react";
import { Button, Card, Checkbox, Modal } from "@/components/ui";
import { useSquadStore } from "@/stores/squadStore";
import { useFixedTeamStore } from "@/stores/fixedTeamStore";
import type { IFixedTeam } from "@/types";

export const FixedTeamManager = () => {
  const { squad } = useSquadStore();
  const { fixedTeams, addFixedTeam, removeFixedTeam } = useFixedTeamStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleToggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleAddFixedTeam = (e: FormEvent) => {
    e.preventDefault();

    if (selectedMemberIds.length < 2) {
      alert("최소 2명 이상 선택해주세요");
      return;
    }

    const newFixedTeam: IFixedTeam = {
      id: Date.now().toString(),
      playerIds: selectedMemberIds,
      active: true,
    };

    addFixedTeam(newFixedTeam);
    setSelectedMemberIds([]);
    setShowAddModal(false);
  };

  const handleDeleteFixedTeam = (teamId: string) => {
    removeFixedTeam(teamId);
    setShowDeleteConfirm(null);
  };

  const getTeamMemberNames = (playerIds: string[]) => {
    return playerIds
      .map((id) => squad?.members.find((m) => m.id === id)?.name)
      .filter((name) => name !== undefined)
      .join(", ");
  };

  return (
    <div className="space-y-6">
      <Card title="고정 팀 설정">
        <p className="mb-4 text-sm text-gray-400">
          항상 같은 팀으로 배정될 멤버를 설정합니다
        </p>

        <div className="mb-4 space-y-2">
          {fixedTeams.length === 0 ? (
            <p className="text-center text-sm text-gray-500">
              설정된 고정 팀이 없습니다
            </p>
          ) : (
            fixedTeams.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between rounded-lg bg-black/20 p-3"
              >
                <div>
                  <p className="text-sm text-gray-400">고정 팀</p>
                  <p className="text-white">
                    {getTeamMemberNames(team.playerIds || [])}
                  </p>
                  <p className="text-xs text-gray-500">
                    {team.playerIds?.length}명
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(team.id)}
                >
                  삭제
                </Button>
              </div>
            ))
          )}
        </div>

        <Button
          onClick={() => setShowAddModal(true)}
          disabled={!squad || squad.members.length < 2}
          className="w-full"
        >
          고정 팀 추가
        </Button>
      </Card>

      {/* 고정 팀 추가 모달 */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSelectedMemberIds([]);
        }}
        title="고정 팀 추가"
      >
        <form onSubmit={handleAddFixedTeam}>
          <p className="mb-4 text-sm text-gray-400">
            같은 팀으로 고정할 멤버를 선택하세요 (최소 2명)
          </p>

          <div className="mb-6 max-h-[300px] space-y-2 overflow-y-auto">
            {squad?.members.map((member) => (
              <Checkbox
                key={member.id}
                label={member.name}
                checked={selectedMemberIds.includes(member.id)}
                onChange={() => handleToggleMember(member.id)}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAddModal(false);
                setSelectedMemberIds([]);
              }}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={selectedMemberIds.length < 2}
              className="flex-1"
            >
              추가 ({selectedMemberIds.length}명)
            </Button>
          </div>
        </form>
      </Modal>

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={showDeleteConfirm !== null}
        onClose={() => setShowDeleteConfirm(null)}
        title="고정 팀 삭제"
      >
        <p className="mb-6 text-gray-300">정말 삭제하시겠습니까?</p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setShowDeleteConfirm(null)}
            className="flex-1"
          >
            취소
          </Button>
          <Button
            variant="danger"
            onClick={() => showDeleteConfirm && handleDeleteFixedTeam(showDeleteConfirm)}
            className="flex-1"
          >
            삭제
          </Button>
        </div>
      </Modal>
    </div>
  );
};
