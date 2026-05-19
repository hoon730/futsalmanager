import { useState } from "react";
import { createPortal } from "react-dom";
import type { IMatch } from "@/types";
import PlaceSearchInput from "@/components/PlaceSearchInput";
import { toFriendlyMessage } from "@/lib/errorMessage";

type MatchInput = Omit<IMatch, "id" | "createdAt" | "squadId">;

interface CreateModeProps {
  mode: "create";
  squadId: string;
  userId: string;
  onClose: () => void;
  onSubmit: (squadId: string, data: MatchInput) => Promise<void>;
}

interface EditModeProps {
  mode: "edit";
  match: IMatch;
  onClose: () => void;
  onSubmit: (data: Partial<MatchInput>) => Promise<void>;
}

type MatchFormModalProps = CreateModeProps | EditModeProps;

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  // 분은 항상 00으로 정규화 (시간 단위 선택)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

/** "YYYY-MM-DDTHH:MM" → "YYYY-MM-DDTHH:00" — 분을 강제로 00으로 */
function normalizeToHour(value: string): string {
  if (!value || value.length < 13) return value;
  return value.substring(0, 13) + ":00";
}

export function MatchFormModal(props: MatchFormModalProps) {
  const isEdit = props.mode === "edit";
  const initial = isEdit ? props.match : null;

  const [matchDate, setMatchDate] = useState(initial ? toLocalDatetime(initial.matchDate) : "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [maxPlayers, setMaxPlayers] = useState(initial?.maxPlayers ?? 15);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      if (props.mode === "create") {
        await props.onSubmit(props.squadId, {
          // title은 더 이상 사용자 입력으로 받지 않음. 식별은 날짜/시간으로.
          // DB 스키마 NOT NULL 호환을 위해 빈 문자열 저장.
          title: "",
          matchDate: new Date(matchDate).toISOString(),
          location: location || undefined,
          maxPlayers,
          notes: notes || undefined,
          createdBy: props.userId,
        });
        props.onClose();
      } else {
        await props.onSubmit({
          // 제목은 더 이상 사용자 편집 대상이 아님. 기존 값 유지.
          title: props.match.title,
          matchDate: new Date(matchDate).toISOString(),
          location: location || undefined,
          maxPlayers,
          notes: notes || undefined,
        });
      }
    } catch (err) {
      setError(toFriendlyMessage(err, isEdit ? "수정에 실패했습니다" : "경기 생성에 실패했습니다"));
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center px-6 z-[9999] animate-fade-in"
      onClick={props.onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 overflow-y-auto"
        style={{ background: "rgba(22,28,22,0.98)", border: "1px solid rgba(13,242,62,0.15)", maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white mb-1">
          {isEdit ? "경기 수정" : "경기 추가"}
        </h2>
        <div className="h-0.5 w-6 bg-primary rounded-full shadow-[0_0_8px_#0df23e] mb-6" />
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">날짜 / 시간 (1시간 단위)</label>
            <input
              type="datetime-local"
              value={matchDate}
              onChange={(e) => setMatchDate(normalizeToHour(e.target.value))}
              step={3600}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">장소 (선택)</label>
            <PlaceSearchInput value={location} onChange={setLocation} />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">최대 인원</label>
            <input
              type="number"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              min={2}
              max={50}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all text-center font-bold"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">메모 (선택)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isEdit ? undefined : "공지사항, 준비물 등"}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-all resize-none"
            />
          </div>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs font-medium">
              {error}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={props.onClose}
              className="flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest bg-white/5 border border-white/10 text-white/40 transition-all active:scale-95"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading || !matchDate}
              className="flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40"
              style={{ backgroundColor: "#0DF23E", color: "#0a150d" }}
            >
              {isLoading ? (isEdit ? "저장 중..." : "생성 중...") : isEdit ? "수정 완료" : "경기 추가"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
