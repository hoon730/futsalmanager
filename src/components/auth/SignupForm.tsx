import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";

interface Props {
  onSwitchToLogin: () => void;
}

export const SignupForm = ({ onSwitchToLogin }: Props) => {
  const { signUp, signInWithKakao, isLoading, error, clearError } = useAuthStore();
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await signUp(email, password, username);
      setDone(true);
    } catch {
      // error는 store에서 관리
    }
  };

  if (done) {
    return (
      <div className="text-center space-y-6 py-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
          <span className="material-icons text-primary text-2xl">mark_email_unread</span>
        </div>
        <div>
          <h2 className="text-xl font-black italic uppercase text-white tracking-tighter">CHECK\nYOUR EMAIL</h2>
          <div className="h-1 w-8 bg-primary mt-2 rounded-full shadow-[0_0_10px_#0df23e] mx-auto" />
        </div>
        <p className="text-white/40 text-sm leading-relaxed">
          <span className="text-primary font-bold">{email}</span>로<br />
          인증 메일을 보냈습니다.<br />
          링크를 클릭하면 가입이 완료됩니다.
        </p>
        <button
          onClick={onSwitchToLogin}
          className="w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
        >
          로그인 화면으로
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">
          닉네임
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="동호회에서 사용할 이름"
          required
          minLength={2}
          maxLength={12}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-primary/50 focus:bg-white/8"
        />
      </div>

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
          placeholder="6자 이상"
          required
          minLength={6}
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
        {isLoading ? "가입 중..." : "회원가입"}
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
          try { await signInWithKakao(); } catch { setKakaoLoading(false); }
        }}
        className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-black text-sm tracking-wide transition-all active:scale-95 disabled:opacity-40"
        style={{ backgroundColor: "#FEE500", color: "#3C1E1E" }}
      >
        <KakaoIcon />
        {kakaoLoading ? "연결 중..." : "카카오로 시작하기"}
      </button>

      <p className="text-center text-white/30 text-xs">
        이미 계정이 있으신가요?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-primary font-black hover:underline"
        >
          로그인
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
  if (msg.includes("User already registered")) return "이미 가입된 이메일입니다.";
  if (msg.includes("Password should be")) return "비밀번호는 6자 이상이어야 합니다.";
  if (msg.includes("Unable to validate")) return "유효하지 않은 이메일 형식입니다.";
  return msg;
};
