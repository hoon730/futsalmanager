import { useState } from "react";
import { useSquadStore } from "@/stores/squadStore";
import { Button, Modal } from "@/components/ui";

export const MemberList = () => {
  const { squad, removeMember } = useSquadStore();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    removeMember(id);
    setDeleteConfirm(null);
  };

  if (!squad?.members || squad.members.length === 0) {
    return (
      <p className="py-8 text-center text-gray-500">등록된 멤버가 없습니다</p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {squad.members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-lg bg-card p-3"
          >
            <span className="text-white">{member.name}</span>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setDeleteConfirm(member.id)}
            >
              삭제
            </Button>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="멤버 삭제"
      >
        <p className="mb-6 text-gray-300">정말 삭제하시겠습니까?</p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setDeleteConfirm(null)}
          >
            취소
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
          >
            삭제
          </Button>
        </div>
      </Modal>
    </>
  );
};
