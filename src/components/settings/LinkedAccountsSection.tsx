// 연결된 OAuth 계정 카드. SettingsPage 에서 분리.
// 현재는 카카오만 지원. 더 늘면 provider 별 row 로 일반화.
import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import { toFriendlyMessage } from "@/lib/errorMessage";

export function LinkedAccountsSection() {
  const { user, linkKakao } = useAuthStore();
  const [kakaoLinkLoading, setKakaoLinkLoading] = useState(false);
  const hasKakaoLinked = user?.identities?.some((i) => i.provider === "kakao") ?? false;

  const handleLinkKakao = async () => {
    setKakaoLinkLoading(true);
    try {
      await linkKakao();
      // linkIdentity 는 OAuth 리다이렉트를 트리거하므로 이 줄 이후 코드는 실행되지 않음
    } catch (e) {
      toast(toFriendlyMessage(e, "카카오 연결에 실패했습니다"), "error");
      setKakaoLinkLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="px-6 mb-6">
      <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3">연결된 계정</p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: hasKakaoLinked ? "#FEE500" : "rgba(255,255,255,0.07)" }}
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path
                  d="M9 1.5C4.86 1.5 1.5 4.19 1.5 7.5c0 2.07 1.2 3.9 3.04 5.03l-.77 2.84a.25.25 0 0 0 .38.27L7.6 13.5c.45.07.92.1 1.4.1 4.14 0 7.5-2.69 7.5-6S13.14 1.5 9 1.5Z"
                  fill={hasKakaoLinked ? "#3C1E1E" : "rgba(255,255,255,0.2)"}
                />
              </svg>
            </div>
            <div>
              <p className="text-white/70 text-sm font-bold">카카오</p>
              <p className="text-[10px] mt-0.5" style={{ color: hasKakaoLinked ? "#0DF23E" : "rgba(255,255,255,0.2)" }}>
                {hasKakaoLinked ? "연결됨" : "연결 안됨"}
              </p>
            </div>
          </div>
          {!hasKakaoLinked && (
            <button
              onClick={handleLinkKakao}
              disabled={kakaoLinkLoading}
              aria-label="카카오 계정 연결"
              className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40"
              style={{ backgroundColor: "rgba(254,229,0,0.15)", color: "#FEE500", border: "1px solid rgba(254,229,0,0.3)" }}
            >
              {kakaoLinkLoading ? "이동 중..." : "연결하기"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
