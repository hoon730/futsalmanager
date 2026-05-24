import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

type Position = "GK" | "DF" | "MF" | "FW";

interface MemberEditModalProps {
  name: string;
  position: Position | null;
  skillLevel: number;
  onClose: () => void;
  onSubmit: (updates: { name: string; positionKey?: Position; skillLevel: number }) => void;
  onDelete: () => void;
}

export function MemberEditModal({
  name,
  position,
  skillLevel,
  onClose,
  onSubmit,
  onDelete,
}: MemberEditModalProps) {
  const [localName, setLocalName] = useState(name);
  const [localPosition, setLocalPosition] = useState<Position | null>(position);
  const [localSkill, setLocalSkill] = useState(skillLevel);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  const handleSubmit = () => {
    const trimmed = localName.trim();
    if (!trimmed) return;
    onSubmit({
      name: trimmed,
      positionKey: localPosition ?? undefined,
      skillLevel: localSkill,
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center px-6 z-[9999] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: "rgba(22,28,22,0.98)", border: "1px solid rgba(13,242,62,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-black italic uppercase tracking-tighter text-white mb-1">선수 편집</h3>
        <p className="text-white/40 text-xs mb-5">이름 · 포지션 · 실력을 수정합니다</p>

        {/* 이름 */}
        <div className="mb-4">
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">이름</label>
          <input
            autoFocus
            type="text"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            maxLength={20}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
            placeholder="선수 이름"
          />
        </div>

        {/* 포지션 */}
        <div className="mb-4">
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">포지션</label>
          <div className="flex gap-2">
            {(["GK", "DF", "MF", "FW"] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => setLocalPosition(localPosition === pos ? null : pos)}
                className="flex-1 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all active:scale-95 border"
                style={
                  localPosition === pos
                    ? { backgroundColor: "#0DF23E", color: "#0a150d", borderColor: "#0DF23E" }
                    : { backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.08)" }
                }
              >
                {pos}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-white/25 mt-2">선택을 다시 누르면 해제됩니다</p>
        </div>

        {/* 실력 */}
        <div className="mb-5">
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">실력</label>
          <div className="flex gap-1 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setLocalSkill(localSkill === star ? 3 : star)}
                className="text-2xl leading-none transition-all active:scale-90 px-1"
                style={{ color: star <= localSkill ? "#FBBF24" : "rgba(255,255,255,0.12)" }}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white/40"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!localName.trim()}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-40"
            style={{ backgroundColor: "#0DF23E", color: "#0a150d" }}
          >
            저장
          </button>
        </div>

        {/* 삭제 */}
        <button
          onClick={onDelete}
          className="w-full mt-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 transition-colors border border-red-500/15"
        >
          <span className="material-icons align-middle text-sm mr-1" style={{ fontSize: 14 }}>delete</span>
          멤버 삭제
        </button>
      </div>
    </div>,
    document.body,
  );
}
