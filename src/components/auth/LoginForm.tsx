import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase";

interface Props {
  onSwitchToSignup: () => void;
}

export const LoginForm = ({ onSwitchToSignup }: Props) => {
  const { signIn, signInWithKakao, isLoading, error, clearError } = useAuthStore();
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await signIn(email, password);
    } catch {
      // error는 store에서 관리
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">
          이메일
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@email.com"
          required
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-primary/50 focus:bg-white/8"
        />
      </div>

      <div>
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">
          비밀번호
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-primary/50 focus:bg-white/8"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs font-medium">
          {translateError(error)}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: "#0DF23E", color: "#0a150d" }}
      >
        {isLoading ? "로그인 중..." : "로그인"}
      </button>

      {/* 구분선 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-[10px] font-black uppercase tracking-widest text-white/20">또는</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* 카카오 로그인 */}
      <button
        type="button"
        disabled={kakaoLoading || isLoading}
        onClick={async () => {
          setKakaoLoading(true);
          const isPWA =
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

          if (isPWA) {
            // PWA 모드: Kakao를 SFSafariViewController(진짜 Safari)에서 열어 iCloud Private Relay 차단 우회
            // window.open은 반드시 첫 번째 동기 호출 위치에 있어야 iOS 팝업 차단을 피할 수 있음
            const popup = window.open("about:blank", "kakaoAuth");
            try {
              const { data, error } = await supabase.auth.signInWithOAuth({
                provider: "kakao",
                options: {
                  redirectTo: window.location.origin,
                  scopes: "profile_nickname profile_image account_email",
                  skipBrowserRedirect: true,
                },
              });
              if (error || !data?.url) { popup?.close(); throw error ?? new Error("OAuth URL 오류"); }
              if (popup) popup.location.href = data.url;

              // 팝업 닫힘 감지 (사용자 취소)
              const pollClosed = setInterval(() => {
                if (popup?.closed) { clearInterval(pollClosed); window.removeEventListener("message", onCode); setKakaoLoading(false); }
              }, 500);

              // index.html 인라인 스크립트가 팝업에서 code를 postMessage로 전송
              const onCode = async (e: MessageEvent) => {
                if (e.origin !== window.location.origin || e.data?.type !== "kakao-oauth-code") return;
                clearInterval(pollClosed);
                window.removeEventListener("message", onCode);
                try {
                  const { error: err } = await supabase.auth.exchangeCodeForSession(e.data.code);
                  if (err) throw err;
                } catch { /* onAuthStateChange가 실패를 처리 */ } finally { setKakaoLoading(false); }
              };
              window.addEventListener("message", onCode);
            } catch { popup?.close(); setKakaoLoading(false); }
          } else {
            try { await signInWithKakao(); } catch { setKakaoLoading(false); }
          }
        }}
        className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-black text-sm tracking-wide transition-all active:scale-95 disabled:opacity-40"
        style={{ backgroundColor: "#FEE500", color: "#3C1E1E" }}
      >
        <KakaoIcon />
        {kakaoLoading ? "연결 중..." : "카카오로 시작하기"}
      </button>

      <p className="text-center text-white/30 text-xs">
        계정이 없으신가요?{" "}
        <button
          type="button"
          onClick={onSwitchToSignup}
          className="text-primary font-black hover:underline"
        >
          회원가입
        </button>
      </p>
    </form>
  );
};

const KakaoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#3C1E1E" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3C6.477 3 2 6.582 2 11c0 2.83 1.67 5.318 4.19 6.82L5.1 21.5l4.53-2.97C10.35 18.84 11.16 19 12 19c5.523 0 10-3.582 10-8s-4.477-8-10-8z" />
  </svg>
);

const translateError = (msg: string) => {
  if (msg.includes("Invalid login credentials")) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (msg.includes("Email not confirmed")) return "이메일 인증이 필요합니다. 메일함을 확인해주세요.";
  if (msg.includes("Too many requests")) return "너무 많은 시도입니다. 잠시 후 다시 시도해주세요.";
  return msg;
};
