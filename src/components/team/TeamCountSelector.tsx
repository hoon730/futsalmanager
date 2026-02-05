import { Modal } from "@/components/ui";

interface ITeamCountSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (count: number) => void;
}

export const TeamCountSelector = ({
  isOpen,
  onClose,
  onSelect,
}: ITeamCountSelectorProps) => {
  const teamCounts = [2, 3, 4, 5];

  const handleSelect = (count: number) => {
    onSelect(count);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="팀 개수 선택">
      <div className="grid grid-cols-2 gap-3">
        {teamCounts.map((count) => (
          <button
            key={count}
            onClick={() => handleSelect(count)}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-gray-600 bg-card p-6 transition-all hover:border-neon hover:bg-card/80 active:scale-95"
          >
            <span className="text-3xl font-bold text-neon">{count}</span>
            <span className="mt-2 text-sm text-gray-400">개 팀</span>
          </button>
        ))}
      </div>
    </Modal>
  );
};
