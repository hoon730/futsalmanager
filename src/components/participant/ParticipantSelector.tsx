import { useSquadStore } from "@/stores/squadStore";
import { Button, Checkbox, Modal } from "@/components/ui";
import { useState } from "react";

export const ParticipantSelector = () => {
  const { squad, selectedParticipants, toggleParticipant, selectAllParticipants, clearAllParticipants } =
    useSquadStore();
  const [showConfirm, setShowConfirm] = useState<"all" | "clear" | null>(null);

  const handleSelectAll = () => {
    selectAllParticipants();
    setShowConfirm(null);
  };

  const handleClearAll = () => {
    clearAllParticipants();
    setShowConfirm(null);
  };

  if (!squad?.members || squad.members.length === 0) {
    return (
      <p className="py-8 text-center text-gray-500">
        멤버를 먼저 등록해주세요
      </p>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {selectedParticipants.length}명 선택됨
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowConfirm("all")}
          >
            전체 선택
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowConfirm("clear")}
          >
            전체 해제
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {squad.members.map((member) => (
          <Checkbox
            key={member.id}
            id={`participant-${member.id}`}
            label={member.name}
            checked={selectedParticipants.includes(member.id)}
            onChange={() => toggleParticipant(member.id)}
          />
        ))}
      </div>

      {/* Confirm Modals */}
      <Modal
        isOpen={showConfirm === "all"}
        onClose={() => setShowConfirm(null)}
        title="전체 선택"
      >
        <p className="mb-6 text-gray-300">
          모든 멤버를 선택하시겠습니까?
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setShowConfirm(null)}
          >
            취소
          </Button>
          <Button className="flex-1" onClick={handleSelectAll}>
            확인
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showConfirm === "clear"}
        onClose={() => setShowConfirm(null)}
        title="전체 해제"
      >
        <p className="mb-6 text-gray-300">
          모든 선택을 해제하시겠습니까?
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setShowConfirm(null)}
          >
            취소
          </Button>
          <Button className="flex-1" onClick={handleClearAll}>
            확인
          </Button>
        </div>
      </Modal>
    </>
  );
};
