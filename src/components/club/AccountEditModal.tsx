// 내 프로필 편집 모달 — 사진 + 닉네임 한 화면에서 동시 편집
// UserMenuPanel 헤더의 ✏️ 아이콘으로 진입
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "@/stores/authStore";
import { AvatarUploader } from "@/components/AvatarUploader";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { toast } from "@/stores/toastStore";
import { toFriendlyMessage } from "@/lib/errorMessage";

interface Props {
  onClose: () => void;
}

export function AccountEditModal({ onClose }: Props) {
  const { user, profile, updateUsername, updateAvatarUrl } = useAuthStore();
  const [nameInput, setNameInput] = useState(profile?.username ?? "");
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, !saving);

  useEffect(() => {
    if (saving) return;
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [saving, onClose]);

  const handleSave = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) { toast("닉네임을 입력해주세요", "error"); return; }
    if (trimmed === (profile?.username ?? "")) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await updateUsername(trimmed);
      toast("프로필이 저장되었습니다");
      onClose();
    } catch (e) {
      toast(toFriendlyMessage(e, "저장에 실패했습니다"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const avatarLetter = (profile?.username || user.email || "?")[0].toUpperCase();

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center px-6 z-[9999] animate-fade-in"
      onClick={() => !saving && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-edit-title"
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: "rgba(22,28,22,0.98)", border: "1px solid rgba(13,242,62,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="account-edit-title" className="text-lg font-black italic uppercase tracking-tighter text-white mb-1">
          내 프로필 편집
        </h3>
        <p className="text-white/40 text-xs mb-5">사진과 닉네임을 수정합니다</p>

        {/* 사진 업로더 */}
        <div className="mb-5 flex justify-center">
          <AvatarUploader
            currentUrl={profile?.avatar_url}
            fallbackText={avatarLetter}
            basePath={`profiles/${user.id}`}
            onUploaded={updateAvatarUrl}
            disabled={saving}
            shape="square"
          />
        </div>

        {/* 닉네임 */}
        <div className="mb-5">
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">닉네임</label>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && nameInput.trim()) handleSave(); }}
            maxLength={30}
            disabled={saving}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
            placeholder="동호회에서 보일 이름"
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
