import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import type { IMember, IFixedTeam } from "@/types";

interface FixedTeamModalProps {
  members: IMember[];
  mercenaries: IMember[];
  selectedParticipants: string[];
  selectedMercenaries: string[];
  fixedTeams: IFixedTeam[];
  onClose: () => void;
  onToggleLock: (playerId1: string, playerId2: string) => void;
}

const FixedTeamModal = ({
  members,
  mercenaries,
  selectedParticipants,
  selectedMercenaries,
  fixedTeams,
  onClose,
  onToggleLock,
}: FixedTeamModalProps) => {
  const [selection, setSelection] = useState<string[]>([]);

  // 오늘 참석하는 멤버와 용병
  const attendingMembers = useMemo(
    () => members.filter((m) => selectedParticipants.includes(m.id)),
    [members, selectedParticipants]
  );

  const attendingMercenaries = useMemo(
    () => mercenaries.filter((m) => selectedMercenaries.includes(m.id)),
    [mercenaries, selectedMercenaries]
  );

  // 이미 고정팀으로 설정된 플레이어인지 확인
  const isLocked = (id: string) => {
    return fixedTeams.some((team) => team.playerIds.includes(id) && team.active);
  };

  const handleSelect = (id: string) => {
    if (isLocked(id)) return;

    if (selection.includes(id)) {
      setSelection((prev) => prev.filter((sid) => sid !== id));
    } else {
      if (selection.length < 2) {
        setSelection((prev) => [...prev, id]);
      }
    }
  };

  const handleConfirm = () => {
    if (selection.length === 2) {
      onToggleLock(selection[0], selection[1]);
      setSelection([]);
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center px-6 animate-fade-in"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[2.5rem] p-8 relative overflow-hidden flex flex-col animate-fade-in"
        style={{
          background: 'rgba(22,38,27,0.95)',
          backdropFilter: 'blur(20px)',
          border: '2px solid rgba(13,242,62,0.3)',
          maxHeight: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 배경 글로우 */}
        <header className="mb-6">
          <h2 className="text-2xl font-black italic uppercase text-white">고정팀 설정</h2>
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">
            Select 2 players to pair
          </p>
        </header>

        <main className="flex-1 overflow-y-auto hide-scrollbar space-y-6">
          {/* 정규 멤버 */}
          {attendingMembers.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-3">
                오늘의 참가자
              </p>
              <div className="grid grid-cols-2 gap-2">
                {attendingMembers.map((member) => (
                  <button
                    key={member.id}
                    disabled={isLocked(member.id)}
                    onClick={() => handleSelect(member.id)}
                    className={`p-2.5 rounded-xl border-2 transition-all flex items-center gap-2 ${
                      selection.includes(member.id)
                        ? "border-primary bg-primary/10"
                        : isLocked(member.id)
                        ? "opacity-20 border-white/5 grayscale"
                        : "border-white/5 bg-white/5"
                    }`}
                  >
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        className="w-6 h-6 rounded-full object-cover"
                        alt={member.name}
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">
                        {member.name[0]}
                      </div>
                    )}
                    <span className="text-xs font-bold truncate">{member.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 용병 */}
          {attendingMercenaries.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-3">
                용병 참가자
              </p>
              <div className="grid grid-cols-2 gap-2">
                {attendingMercenaries.map((merc) => (
                  <button
                    key={merc.id}
                    disabled={isLocked(merc.id)}
                    onClick={() => handleSelect(merc.id)}
                    className={`p-3 rounded-xl border-2 transition-all flex items-center gap-2 ${
                      selection.includes(merc.id)
                        ? "border-primary bg-primary/10"
                        : isLocked(merc.id)
                        ? "opacity-20 border-white/5 grayscale"
                        : "border-white/5 bg-white/5"
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-black text-primary">
                      G
                    </div>
                    <span className="text-xs font-bold truncate">{merc.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {attendingMembers.length === 0 && attendingMercenaries.length === 0 && (
            <div className="py-12 text-center">
              <span className="material-icons text-white/10 text-5xl">group_off</span>
              <p className="text-xs text-white/20 mt-4">오늘 참석한 선수가 없습니다</p>
            </div>
          )}
        </main>

        <footer className="mt-8 space-y-3">
          <button
            disabled={selection.length !== 2}
            onClick={handleConfirm}
            className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all ${
              selection.length === 2
                ? "bg-primary text-background-dark neon-glow"
                : "bg-white/5 text-white/20"
            }`}
          >
            <span className="material-icons">link</span>
            팀 고정하기
          </button>
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-xl text-sm font-black uppercase tracking-[0.2em] transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(13,242,62,0.4)';
              (e.currentTarget as HTMLButtonElement).style.color = '#0DF23E';
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(13,242,62,0.05)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)';
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
            }}
          >
            뒤로가기
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
};

export default FixedTeamModal;
