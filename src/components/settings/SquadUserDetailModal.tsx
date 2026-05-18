import { createPortal } from "react-dom";
import type { ISquadUserRow } from "./types";

interface SquadUserDetailModalProps {
  user: ISquadUserRow;
  onClose: () => void;
  onChangeRole: (userId: string, newRole: "admin" | "member") => void;
  onRemove: (userId: string, username: string) => void;
}

export function SquadUserDetailModal({ user, onClose, onChangeRole, onRemove }: SquadUserDetailModalProps) {
  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center px-6 z-[9999] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: "rgba(22,28,22,0.98)", border: "1px solid rgba(13,242,62,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 — 멤버 정보 */}
        <div className="px-5 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-base font-bold"
              style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}
            >
              {user.username[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-base truncate">{user.username}</p>
              <p
                className="text-[10px] font-black uppercase tracking-widest mt-0.5"
                style={{
                  color: user.role === "owner" ? "#FFD700"
                       : user.role === "admin" ? "#0DF23E"
                       : "rgba(255,255,255,0.4)",
                }}
              >
                {user.role.toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* 통계 */}
        <div className="px-5 py-4 border-b border-white/5 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30 mb-1.5">가입일</p>
            <p className="text-sm font-bold text-white">
              {new Date(user.joinedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30 mb-1.5">출석률</p>
            {user.totalMatches > 0 ? (
              <div className="flex items-baseline gap-1.5">
                <p
                  className="text-sm font-black"
                  style={{
                    color: user.attendanceRate >= 80 ? "#0DF23E"
                         : user.attendanceRate >= 50 ? "#f59e0b"
                         : "#ef4444",
                  }}
                >
                  {user.attendanceRate}%
                </p>
                <p className="text-[10px] font-bold text-white/40">
                  ({user.attendedMatches}/{user.totalMatches})
                </p>
              </div>
            ) : (
              <p className="text-sm font-bold text-white/30">기록 없음</p>
            )}
          </div>
        </div>

        {/* 액션 */}
        <div className="py-1">
          {user.role === "member" && (
            <button
              onClick={() => { onChangeRole(user.userId, "admin"); onClose(); }}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition-colors text-left"
            >
              <span className="material-icons text-primary" style={{ fontSize: 18 }}>arrow_upward</span>
              <span className="text-sm font-bold text-white/85">관리자로 승급</span>
            </button>
          )}
          {user.role === "admin" && (
            <button
              onClick={() => { onChangeRole(user.userId, "member"); onClose(); }}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition-colors text-left"
            >
              <span className="material-icons text-white/50" style={{ fontSize: 18 }}>arrow_downward</span>
              <span className="text-sm font-bold text-white/85">일반 멤버로 강등</span>
            </button>
          )}
          <button
            onClick={() => { onRemove(user.userId, user.username); onClose(); }}
            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-red-500/10 transition-colors text-left border-t border-white/5"
          >
            <span className="material-icons text-red-400" style={{ fontSize: 18 }}>person_remove</span>
            <span className="text-sm font-bold text-red-400">동호회에서 내보내기</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 text-xs font-black uppercase tracking-widest text-white/40 border-t border-white/5 hover:bg-white/[0.02] transition-colors"
        >
          닫기
        </button>
      </div>
    </div>,
    document.body,
  );
}
