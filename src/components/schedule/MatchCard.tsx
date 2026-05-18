import type { IMatch, IMatchAttendee, IMember } from "@/types";
import { STATUS_CONFIG, getDDay } from "./scheduleUtils";

interface MatchCardProps {
  match: IMatch;
  attendees: IMatchAttendee[];
  mercenaries: IMember[];
  userId?: string;
  isPast?: boolean;
  onOpen: () => void;
}

export function MatchCard({ match, attendees, mercenaries, userId, isPast, onOpen }: MatchCardProps) {
  const attending = attendees.filter((a) => a.status === "attending");
  const myStatus = attendees.find((a) => a.userId === userId)?.status ?? null;
  // 참석 인원 = 참석 투표 + 용병 (정원 마감 계산에 반영)
  const totalAttending = attending.length + mercenaries.length;
  const isFull = !isPast && totalAttending >= match.maxPlayers;
  const date = new Date(match.matchDate);
  const statusCfg = myStatus ? STATUS_CONFIG[myStatus] : null;
  const dday = !isPast ? getDDay(match.matchDate) : null;
  const isDDay = dday === "D-Day";

  const isMine = myStatus === "attending" && !isPast;
  const weekday = date.toLocaleDateString("ko-KR", { weekday: "short" });
  const timeStr = date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const percent = Math.min((totalAttending / match.maxPlayers) * 100, 100);

  return (
    <button
      onClick={onOpen}
      className={`w-full text-left rounded-2xl border transition-all active:scale-[0.98] ${isPast ? "opacity-50" : ""} ${isMine ? "border-primary/20 bg-primary/5" : "border-white/5 bg-white/5"}`}
    >
      {/* 상단 본문 */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* 날짜 박스 — 기록 페이지와 통일 (월 + 일, 정사각) */}
          <div className={`flex-shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center border ${
            isMine ? "bg-primary/10 border-primary/40" : "bg-primary/5 border-primary/20"
          }`}>
            <span className="text-[10px] font-black text-white/40">
              {date.toLocaleDateString("ko-KR", { month: "short" })}
            </span>
            <span className="text-xl font-black text-primary leading-tight">{date.getDate()}</span>
          </div>

          {/* 메인 정보 — 시간(크게, 요일 함께) + 장소 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-white font-black text-lg leading-tight">
                {weekday} <span className="text-white/70">·</span> {timeStr}
              </p>
              {/* 우상단 뱃지 */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isFull && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-500/15 text-red-400/80">마감</span>
                )}
                {dday && !isFull && (
                  <span
                    className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isDDay ? "animate-pulse" : ""}`}
                    style={{
                      backgroundColor: isDDay ? "rgba(13,242,62,0.18)" : "rgba(255,255,255,0.06)",
                      color: "#0DF23E",
                      boxShadow: isDDay ? "0 0 8px rgba(13,242,62,0.3)" : "none",
                    }}
                  >
                    {dday}
                  </span>
                )}
              </div>
            </div>
            {match.location && (
              <p className="flex items-center gap-1 text-white/40 text-xs truncate">
                <span className="material-icons" style={{ fontSize: 12 }}>location_on</span>
                <span className="truncate">{match.location}</span>
              </p>
            )}
            {/* 메모 1줄 미리보기 (있을 때만) */}
            {match.notes && (
              <p className="flex items-center gap-1 text-white/30 text-xs truncate mt-1">
                <span className="material-icons" style={{ fontSize: 12 }}>sticky_note_2</span>
                <span className="truncate">{match.notes}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 하단 푸터 — 진행도 + 내 상태 */}
      <div className="px-4 pb-3 pt-1 border-t border-white/[0.04]">
        <div className="flex items-center gap-2.5 mt-2">
          <span className={`text-xs font-black flex-shrink-0 ${isMine ? "text-primary" : "text-white/50"}`}>
            {totalAttending}
            <span className="text-white/30 font-bold"> / {match.maxPlayers}</span>
          </span>
          <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${percent}%`,
                backgroundColor: isFull ? "#f97316" : isMine ? "#0DF23E" : "rgba(255,255,255,0.25)",
              }}
            />
          </div>
          {/* 내 상태 */}
          {statusCfg ? (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: statusCfg.dimBg, color: statusCfg.color }}>
              {statusCfg.label}
            </span>
          ) : !isPast ? (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/5 text-white/30 flex-shrink-0">미응답</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
