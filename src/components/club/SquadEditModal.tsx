// 동호회 정보 편집 모달 — 로고 + 이름 한 화면에서 동시 편집
// UserMenuPanel 동호회 카드의 ✏️ 아이콘으로 진입 (운영자만)
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSquadStore } from "@/stores/squadStore";
import { supabase } from "@/lib/supabase";
import { AvatarUploader } from "@/components/AvatarUploader";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { toast } from "@/stores/toastStore";
import { toFriendlyMessage } from "@/lib/errorMessage";

interface Props {
  onClose: () => void;
}

export function SquadEditModal({ onClose }: Props) {
  const { squad, updateSquadName, updateSquadLogo } = useSquadStore();
  const [nameInput, setNameInput] = useState(squad?.name ?? "");
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, !saving);

  useEffect(() => {
    if (saving) return;
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [saving, onClose]);

  /** 로고 업로드 → DB + 로컬 store 동기화 */
  const handleLogoUploaded = async (url: string) => {
    if (!squad?.id) return;
    const { error } = await supabase.from("squads").update({ logo_url: url }).eq("id", squad.id);
    if (error) throw error;
    updateSquadLogo(url);
  };

  const handleSave = async () => {
    if (!squad?.id) return;
    const trimmed = nameInput.trim();
    if (!trimmed) { toast("동호회 이름을 입력해주세요", "error"); return; }
    if (trimmed === (squad.name ?? "")) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("squads")
        .update({ name: trimmed })
        .eq("id", squad.id);
      if (error) throw error;
      updateSquadName(trimmed);
      toast("동호회 정보가 저장되었습니다");
      onClose();
    } catch (e) {
      toast(toFriendlyMessage(e, "저장에 실패했습니다"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (!squad) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center px-6 z-[9999] animate-fade-in"
      onClick={() => !saving && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="squad-edit-title"
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: "rgba(22,28,22,0.98)", border: "1px solid rgba(13,242,62,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="squad-edit-title" className="text-lg font-black italic uppercase tracking-tighter text-white mb-1">
          동호회 정보 편집
        </h3>
        <p className="text-white/40 text-xs mb-5">로고와 이름을 수정합니다</p>

        {/* 로고 업로더 */}
        <div className="mb-5 flex justify-center">
          <AvatarUploader
            currentUrl={squad.logoUrl}
            fallbackText={squad.name}
            basePath={`squads/${squad.id}`}
            onUploaded={handleLogoUploaded}
            disabled={saving}
            shape="square"
          />
        </div>

        {/* 동호회 이름 */}
        <div className="mb-5">
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">동호회 이름</label>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && nameInput.trim()) handleSave(); }}
            maxLength={30}
            disabled={saving}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
            placeholder="예: 강남 풋살 FC"
          />
        </div>

        {/* 버튼 */}
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
            onClick={handleSave}
            disabled={saving || !nameInput.trim()}
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
