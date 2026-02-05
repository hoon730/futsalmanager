import { useState } from "react";
import { Card, Button, Modal } from "@/components/ui";
import { useDivisionStore } from "@/stores/divisionStore";
import type { IDivision } from "@/types";

export const DivisionHistory = () => {
  const { divisionHistory, deleteDivision } = useDivisionStore();
  const [selectedDivision, setSelectedDivision] = useState<IDivision | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDelete = (id: string) => {
    deleteDivision(id);
    setDeleteConfirmId(null);
  };

  const teamColors = [
    "border-[#ff6b6b] bg-[#ff6b6b]/10",
    "border-[#4facfe] bg-[#4facfe]/10",
    "border-[#43e97b] bg-[#43e97b]/10",
    "border-[#fa709a] bg-[#fa709a]/10",
    "border-[#a8edea] bg-[#a8edea]/10",
  ];

  const teamNames = ["A", "B", "C", "D", "E"];

  if (divisionHistory.length === 0) {
    return (
      <Card title="팀 나누기 이력">
        <p className="text-center text-gray-400">
          아직 저장된 이력이 없습니다
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card title="팀 나누기 이력">
        <div className="space-y-2">
          {[...divisionHistory].reverse().map((division) => (
            <div
              key={division.id}
              className="flex items-center justify-between rounded-lg bg-black/20 p-3"
            >
              <div
                className="flex-1 cursor-pointer"
                onClick={() => setSelectedDivision(division)}
              >
                <p className="text-sm text-gray-400">
                  {formatDate(division.divisionDate)}
                </p>
                <p className="text-white">
                  {division.notes || `${division.teamCount}팀 나누기`}
                </p>
                <p className="text-xs text-gray-500">
                  {division.teams.reduce((sum, team) => sum + team.length, 0)}명 참가
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirmId(division.id);
                }}
              >
                삭제
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* 이력 상세 모달 */}
      <Modal
        isOpen={selectedDivision !== null}
        onClose={() => setSelectedDivision(null)}
        title="팀 나누기 결과"
      >
        {selectedDivision && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-400">
                {formatDate(selectedDivision.divisionDate)}
              </p>
              <p className="mt-1 text-lg font-bold text-white">
                {selectedDivision.notes || `${selectedDivision.teamCount}팀 나누기`}
              </p>
            </div>

            <div className="space-y-3">
              {selectedDivision.teams.map((team, index) => (
                <div
                  key={index}
                  className={`rounded-xl border-2 p-4 ${teamColors[index]}`}
                >
                  <div className="mb-3 text-center">
                    <h3 className="text-xl font-bold text-white">
                      {teamNames[index]}팀
                    </h3>
                    <p className="text-sm text-gray-400">{team.length}명</p>
                  </div>
                  <div className="space-y-2">
                    {team.map((member, memberIndex) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 rounded-lg bg-black/20 p-2"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                          {memberIndex + 1}
                        </span>
                        <span className="text-white">{member.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="이력 삭제"
      >
        <p className="mb-6 text-gray-300">정말 삭제하시겠습니까?</p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setDeleteConfirmId(null)}
            className="flex-1"
          >
            취소
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            className="flex-1"
          >
            삭제
          </Button>
        </div>
      </Modal>
    </>
  );
};
