import { createPortal } from "react-dom";
import type { IMember } from "@/types";

interface LinkMemberModalProps {
  members: IMember[];
  linkedMemberId: string | null;
  currentUserId: string | null;
  onClose: () => void;
  onLink: (member: IMember | null) => void;
}

export function LinkMemberModal({ members, linkedMemberId, currentUserId, onClose, onLink }: LinkMemberModalProps) {
  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center px-6 z-[9999] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 overflow-y-auto"
        style={{ background: "rgba(22,28,22,0.98)", border: "1px solid rgba(13,242,62,0.15)", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-black italic uppercase tracking-tighter text-white mb-1">내 선수 선택</h3>
        <p className="text-white/40 text-xs mb-5">명단에서 나의 이름을 선택하세요</p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {members.map((member) => {
            const isMine = linkedMemberId === member.id;
            // 다른 유저가 이미 연결한 멤버 (본인이 연결한 건 제외)
            const takenByOther = !!member.linkedUserId && member.linkedUserId !== currentUserId;
            return (
              <button
                key={member.id}
                onClick={() => !takenByOther && onLink(member)}
                disabled={takenByOther}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  isMine
                    ? "bg-primary/10 border-primary/30"
                    : takenByOther
                      ? "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"
                      : "bg-white/5 border-white/5 hover:border-white/20"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isMine ? "bg-primary/20 text-primary" : "bg-white/10 text-white/60"
                  }`}
                >
                  {member.name.slice(0, 1)}
                </div>
                <span className={`font-bold text-sm ${isMine ? "text-primary" : takenByOther ? "text-white/40" : "text-white"}`}>
                  {member.name}
                </span>
                {isMine && (
                  <span className="material-icons text-primary text-sm ml-auto">check_circle</span>
                )}
                {takenByOther && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-auto flex items-center gap-1">
                    <span className="material-icons" style={{ fontSize: 12 }}>lock</span>
                    연결됨
                  </span>
                )}
              </button>
            );
          })}
          {members.length === 0 && (
            <p className="text-center text-white/20 text-xs py-6">등록된 멤버가 없습니다</p>
          )}
        </div>
        {linkedMemberId && (
          <button
            onClick={() => onLink(null)}
            className="w-full mt-4 py-3 text-red-400/60 hover:text-red-400 text-xs font-black uppercase tracking-widest transition-colors"
          >
            연결 해제
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
