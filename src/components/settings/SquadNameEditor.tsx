import { useState } from "react";
import type { FormEvent } from "react";
import { Button, Card, Modal, Input } from "@/components/ui";
import { useSquadStore } from "@/stores/squadStore";

export const SquadNameEditor = () => {
  const { squad, updateSquadName } = useSquadStore();
  const [showEditModal, setShowEditModal] = useState(false);
  const [newName, setNewName] = useState("");

  const handleOpenModal = () => {
    setNewName(squad?.name || "");
    setShowEditModal(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      updateSquadName(newName.trim());
      setShowEditModal(false);
    }
  };

  return (
    <>
      <Card title="스쿼드 이름">
        <div className="flex items-center justify-between">
          <p className="text-xl font-bold text-white">{squad?.name || "내 스쿼드"}</p>
          <Button size="sm" onClick={handleOpenModal}>
            변경
          </Button>
        </div>
      </Card>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="스쿼드 이름 변경"
      >
        <form onSubmit={handleSubmit}>
          <Input
            type="text"
            placeholder="스쿼드 이름을 입력하세요"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowEditModal(false)}
              className="flex-1"
            >
              취소
            </Button>
            <Button type="submit" disabled={!newName.trim()} className="flex-1">
              확인
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
