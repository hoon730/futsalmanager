import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { IMatch } from "@/types";
import PlaceSearchInput from "@/components/PlaceSearchInput";
import { toFriendlyMessage } from "@/lib/errorMessage";
import { supabase } from "@/lib/supabase";
import { computeRsvpDeadline, deadlineToHoursBefore } from "./scheduleUtils";

type MatchInput = Omit<IMatch, "id" | "createdAt" | "squadId">;

interface CreateModeProps {
  mode: "create";
  squadId: string;
  userId: string;
  isAdmin?: boolean;
  onClose: () => void;
  onSubmit: (squadId: string, data: MatchInput) => Promise<void>;
}

interface EditModeProps {
  mode: "edit";
  match: IMatch;
  isAdmin?: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<MatchInput>) => Promise<void>;
}

interface SavedVenue { id: string; name: string; address?: string; }

type MatchFormModalProps = CreateModeProps | EditModeProps;

/** ISO → "YYYY-MM-DD" */
function toLocalDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" + hour → ISO string */
function combineDateHour(date: string, hour: number): string {
  if (!date) return "";
  // 로컬 타임존 기준으로 매치 일자/시간 구성 후 ISO 변환
  return new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`).toISOString();
}

export function MatchFormModal(props: MatchFormModalProps) {
  const isEdit = props.mode === "edit";
  const initial = isEdit ? props.match : null;
  const squadId = props.mode === "create" ? props.squadId : props.match.squadId;
  const isAdmin = props.isAdmin ?? false;

  const initialDate = initial ? new Date(initial.matchDate) : null;
  const [matchDate, setMatchDate] = useState<string>(initialDate ? toLocalDate(initial!.matchDate) : "");
  // 디폴트 시간: 기존 매치는 그 시간, 신규는 19시 (저녁 7시)
  const [matchHour, setMatchHour] = useState<number>(initialDate ? initialDate.getHours() : 19);
  const [location, setLocation] = useState(initial?.location ?? "");
  const [maxPlayers, setMaxPlayers] = useState(initial?.maxPlayers ?? 15);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  // 반복 일정 (create 모드 전용)
  const [repeatWeeks, setRepeatWeeks] = useState(0);
  // 참가 신청 마감: 경기 시각 N시간 전 (0 = 마감 없음)
  // edit 모드에서는 기존 rsvp_deadline 을 역산해서 초기화
  const initialRsvpHours = isEdit
    ? deadlineToHoursBefore(initial!.matchDate, initial!.rsvpDeadline)
    : 0;
  const [rsvpHoursBefore, setRsvpHoursBefore] = useState<number>(initialRsvpHours);
  // 커스텀 시간 드롭다운
  const [showTimePicker, setShowTimePicker] = useState(false);
  const timePickerRef = useRef<HTMLDivElement>(null);

  // 즐겨찾기 장소
  const [savedVenues, setSavedVenues] = useState<SavedVenue[]>([]);
  const [savingVenue, setSavingVenue] = useState(false);

  useEffect(() => {
    if (!squadId) return;
    supabase
      .from("squad_venues")
      .select("id, name, address")
      .eq("squad_id", squadId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setSavedVenues(data as SavedVenue[]); });
  }, [squadId]);

  const handleSaveVenue = async () => {
    if (!location.trim() || !squadId) return;
    setSavingVenue(true);
    try {
      const { data, error } = await supabase
        .from("squad_venues")
        .insert({ squad_id: squadId, name: location.trim(), address: location.trim() })
        .select("id, name, address")
        .single();
      if (error) throw error;
      setSavedVenues((prev) => [data as SavedVenue, ...prev]);
    } finally {
      setSavingVenue(false);
    }
  };

  const handleDeleteVenue = async (venueId: string) => {
    await supabase.from("squad_venues").delete().eq("id", venueId);
    setSavedVenues((prev) => prev.filter((v) => v.id !== venueId));
  };

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [props.onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // 시간 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!showTimePicker) return;
    const handle = (e: MouseEvent) => {
      if (timePickerRef.current && !timePickerRef.current.contains(e.target as Node)) {
        setShowTimePicker(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showTimePicker]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchDate) {
      setError("날짜를 선택해주세요");
      return;
    }
    const matchDateIso = combineDateHour(matchDate, matchHour);
    setIsLoading(true);
    setError("");
    try {
      if (props.mode === "create") {
        // 반복 일정: 1번 + repeatWeeks번 추가 = 총 (1 + repeatWeeks)회
        const totalCount = 1 + repeatWeeks;
        for (let i = 0; i < totalCount; i++) {
          const date = new Date(matchDateIso);
          date.setDate(date.getDate() + i * 7);
          const dateIso = date.toISOString();
          await props.onSubmit(props.squadId, {
            title: "",
            matchDate: dateIso,
            location: location || undefined,
            maxPlayers,
            notes: notes || undefined,
            createdBy: props.userId,
            rsvpDeadline: computeRsvpDeadline(dateIso, rsvpHoursBefore),
          });
        }
        props.onClose();
      } else {
        await props.onSubmit({
          // 제목은 더 이상 사용자 편집 대상이 아님. 기존 값 유지.
          title: props.match.title,
          matchDate: matchDateIso,
          location: location || undefined,
          maxPlayers,
          notes: notes || undefined,
          rsvpDeadline: computeRsvpDeadline(matchDateIso, rsvpHoursBefore),
        });
        // edit 모드에서도 저장 성공 후 모달 자동 닫기 (부모 wrapper에만 의존하지 않도록)
        props.onClose();
      }
    } catch (err) {
      setError(toFriendlyMessage(err, isEdit ? "수정에 실패했습니다" : "경기 생성에 실패했습니다"));
    } finally {
      setIsLoading(false);
    }
  };

  // 시간 옵션: 0~23시
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  const formatHourLabel = (h: number) => {
    const period = h < 12 ? "오전" : "오후";
    const display = h === 0 ? 12 : h <= 12 ? h : h - 12;
    return `${period} ${display}:00`;
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
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">날짜 / 시간</label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                required
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all [color-scheme:dark]"
              />
              <div className="relative" ref={timePickerRef}>
                <button
                  type="button"
                  onClick={() => setShowTimePicker((v) => !v)}
                  className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white font-bold outline-none transition-all whitespace-nowrap"
                  style={showTimePicker ? { borderColor: "rgba(13,242,62,0.5)" } : {}}
                >
                  {formatHourLabel(matchHour)}
                  <span className="material-icons text-white/30" style={{ fontSize: 14 }}>
                    {showTimePicker ? "expand_less" : "expand_more"}
                  </span>
                </button>
                {showTimePicker && (
                  <div
                    className="absolute right-0 top-full mt-1 z-50 rounded-xl overflow-y-auto hide-scrollbar"
                    style={{
                      background: "rgba(18,24,18,0.98)",
                      border: "1px solid rgba(13,242,62,0.15)",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                      minWidth: "110px",
                      maxHeight: "220px",
                    }}
                  >
                    {hourOptions.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => { setMatchHour(h); setShowTimePicker(false); }}
                        className="w-full px-4 py-2.5 text-sm text-left transition-colors"
                        style={{
                          color: h === matchHour ? "#0DF23E" : "rgba(255,255,255,0.65)",
                          backgroundColor: h === matchHour ? "rgba(13,242,62,0.08)" : "transparent",
                          fontWeight: h === matchHour ? 700 : 400,
                        }}
                      >
                        {formatHourLabel(h)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="text-[10px] text-white/30 mt-1.5">분은 자동으로 00분</p>
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
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">장소 (선택)</label>
            {/* 즐겨찾기 장소 칩 */}
            {savedVenues.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {savedVenues.map((v) => (
                  <div key={v.id} className="flex items-center gap-1 group">
                    <button
                      type="button"
                      onClick={() => setLocation(v.name)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95"
                      style={
                        location === v.name
                          ? { backgroundColor: "rgba(13,242,62,0.15)", color: "#0DF23E", border: "1px solid rgba(13,242,62,0.3)" }
                          : { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }
                      }
                    >
                      <span className="material-icons" style={{ fontSize: 11 }}>place</span>
                      {v.name}
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteVenue(v.id)}
                        className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-white/30 hover:text-red-400 transition-all"
                      >
                        <span className="material-icons" style={{ fontSize: 10 }}>close</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <div className="flex-1">
                <PlaceSearchInput value={location} onChange={setLocation} />
              </div>
              {isAdmin && location.trim() && !savedVenues.some((v) => v.name === location.trim()) && (
                <button
                  type="button"
                  onClick={handleSaveVenue}
                  disabled={savingVenue}
                  className="px-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 transition-all active:scale-95 disabled:opacity-40"
                  style={{ backgroundColor: "rgba(13,242,62,0.1)", color: "#0DF23E", border: "1px solid rgba(13,242,62,0.2)" }}
                  title="즐겨찾기에 추가"
                >
                  <span className="material-icons" style={{ fontSize: 14 }}>star_outline</span>
                </button>
              )}
            </div>
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
          {/* 참가 신청 마감 (선택) — 경기 시각 기준 N시간 전 */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">
              참가 신청 마감 (선택)
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { value: 0,  label: "마감 없음" },
                { value: 1,  label: "1시간 전" },
                { value: 3,  label: "3시간 전" },
                { value: 6,  label: "6시간 전" },
                { value: 12, label: "12시간 전" },
                { value: 24, label: "24시간 전" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRsvpHoursBefore(opt.value)}
                  className="px-3 py-2 rounded-xl text-xs font-black transition-all active:scale-95 border"
                  style={
                    rsvpHoursBefore === opt.value
                      ? { backgroundColor: "rgba(13,242,62,0.15)", color: "#0DF23E", borderColor: "rgba(13,242,62,0.3)" }
                      : { backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.08)" }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {rsvpHoursBefore > 0 && (
              <p className="text-[10px] text-primary/60 mt-1.5">
                마감 이후엔 일반 멤버는 참석 응답을 변경할 수 없습니다.
              </p>
            )}
          </div>

          {/* 반복 일정 — create 모드 전용 */}
          {!isEdit && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">
                반복 (선택)
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {[0, 1, 2, 3, 4].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setRepeatWeeks(w)}
                    className="px-3 py-2 rounded-xl text-xs font-black transition-all active:scale-95 border"
                    style={
                      repeatWeeks === w
                        ? { backgroundColor: "rgba(13,242,62,0.15)", color: "#0DF23E", borderColor: "rgba(13,242,62,0.3)" }
                        : { backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.08)" }
                    }
                  >
                    {w === 0 ? "반복 없음" : `${w}주 반복`}
                  </button>
                ))}
              </div>
              {repeatWeeks > 0 && (
                <p className="text-[10px] text-primary/60 mt-1.5">
                  총 {1 + repeatWeeks}회 경기가 매주 같은 요일/시간으로 생성됩니다
                </p>
              )}
            </div>
          )}
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
              {isLoading
                ? (isEdit ? "저장 중..." : "생성 중...")
                : isEdit
                  ? "수정 완료"
                  : repeatWeeks > 0 ? `${1 + repeatWeeks}회 추가` : "경기 추가"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
