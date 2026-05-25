import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AvatarUploader } from "@/components/AvatarUploader";

type Position = "GK" | "DF" | "MF" | "FW";

interface EditMyMemberModalProps {
  memberId: string;
  name: string;
  position: Position | null;
  avatarUrl?: string | null;
  saving: boolean;
  onChangeName: (name: string) => void;
  onChangePosition: (pos: Position | null) => void;
  onAvatarChange: (url: string) => Promise<void>;
  onClose: () => void;
  onSubmit: () => void;
}

export function EditMyMemberModal({
  memberId,
  name,
  position,
  avatarUrl,
  saving,
  onChangeName,
  onChangePosition,
  onAvatarChange,
  onClose,
  onSubmit,
}: EditMyMemberModalProps) {
  useEffect(() => {
    if (saving) return;
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [saving, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center px-6 z-[9999] animate-fade-in"
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: "rgba(22,28,22,0.98)", border: "1px solid rgba(13,242,62,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-black italic uppercase tracking-tighter text-white mb-1">내 선수 정보</h3>
        <p className="text-white/40 text-xs mb-5">동호회에 표시될 사진 · 이름 · 포지션을 수정합니다</p>

        {/* 사진 업로드 */}
        <div className="mb-5 flex justify-center">
          <AvatarUploader
            currentUrl={avatarUrl}
            fallbackText={name}
            basePath={`members/${memberId}`}
            onUploaded={onAvatarChange}
            disabled={saving}
          />
        </div>

        <div className="mb-4">
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">이름</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => onChangeName(e.target.value)}
            maxLength={20}
            disabled={saving}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
            placeholder="동호회 이름"
          />
        </div>

        <div className="mb-4">
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">포지션</label>
          <div className="flex gap-2">
            {(["GK", "DF", "MF", "FW"] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => onChangePosition(position === pos ? null : pos)}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all active:scale-95 border"
                style={position === pos
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

        <div className="mb-5 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
          <p className="text-[10px] text-white/40 leading-relaxed">
            <span className="material-icons align-middle text-xs text-white/30 mr-1">info</span>
            스킬은 공정한 팀 배정을 위해 운영자만 변경할 수 있습니다
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white/40 disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            disabled={saving || !name.trim()}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-40"
            style={{ backgroundColor: "#0DF23E", color: "#0a150d" }}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
