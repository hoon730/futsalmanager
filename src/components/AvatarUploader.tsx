// 아바타 업로드 위젯 — 프로필/멤버/동호회 로고 공통
import { useRef, useState } from "react";
import { uploadAvatar } from "@/lib/imageUpload";
import { toast } from "@/stores/toastStore";
import { toFriendlyMessage } from "@/lib/errorMessage";

interface Props {
  /** 현재 표시 중인 이미지 URL (없으면 fallbackText) */
  currentUrl?: string | null;
  /** 이미지 없을 때 표시할 글자 (이름의 첫 글자 등) */
  fallbackText?: string;
  /** Storage 저장 경로 (확장자 제외). 예: "members/m-123" */
  basePath: string;
  /** 업로드 성공 후 받은 public URL 처리 (DB 업데이트 등) */
  onUploaded: (url: string) => Promise<void> | void;
  /** 위젯 크기 (px) */
  size?: number;
  disabled?: boolean;
  /** 모서리 (round = 원형, square = 둥근 사각형 — 로고용) */
  shape?: "round" | "square";
  /** 라벨("사진 변경") 표시 여부. 기본 true */
  showLabel?: boolean;
}

export function AvatarUploader({
  currentUrl,
  fallbackText,
  basePath,
  onUploaded,
  size = 80,
  disabled,
  shape = "round",
  showLabel = true,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(file, basePath);
      await onUploaded(url);
      toast("사진이 업데이트되었습니다");
    } catch (err) {
      toast(toFriendlyMessage(err, "사진 업로드에 실패했습니다"), "error");
    } finally {
      setUploading(false);
    }
  };

  const open = () => { if (!disabled && !uploading) fileInputRef.current?.click(); };
  const radius = shape === "round" ? "9999px" : "1rem";

  return (
    <div className="flex flex-col items-center gap-2.5">
      <button
        type="button"
        onClick={open}
        disabled={disabled || uploading}
        className="relative overflow-hidden border-2 transition-all active:scale-95 disabled:opacity-60"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          borderColor: "rgba(13,242,62,0.3)",
          background: "rgba(13,242,62,0.10)",
        }}
      >
        {currentUrl ? (
          <img src={currentUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span
            className="text-xl font-black text-primary flex items-center justify-center w-full h-full"
            style={{ fontSize: size * 0.32 }}
          >
            {fallbackText?.slice(0, 1) ?? "?"}
          </span>
        )}
        {/* 업로드 중 오버레이 */}
        {uploading && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            <div className="loading-spinner" style={{ width: 22, height: 22 }} />
          </div>
        )}
        {/* 우하단 카메라 인디케이터 — 작고 미묘하게 (disabled 면 숨김) */}
        {!uploading && !disabled && (
          <div
            className="absolute right-0 bottom-0 w-4 h-4 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(13,242,62,0.85)",
              border: "1.5px solid rgba(10,21,13,0.95)",
            }}
            aria-hidden="true"
          >
            <span className="material-icons text-[#0a150d]" style={{ fontSize: 10 }}>photo_camera</span>
          </div>
        )}
      </button>
      {showLabel && (
        <button
          type="button"
          onClick={open}
          disabled={disabled || uploading}
          className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-primary transition-colors disabled:opacity-40"
        >
          {uploading ? "업로드 중..." : currentUrl ? "사진 변경" : "사진 추가"}
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
