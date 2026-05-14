import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";

interface Props {
  onSwitchToSignup: () => void;
}

export const LoginForm = ({ onSwitchToSignup }: Props) => {
  const { signIn, isLoading, error, clearError } = useAuthStore();
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

const translateError = (msg: string) => {
  if (msg.includes("Invalid login credentials")) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (msg.includes("Email not confirmed")) return "이메일 인증이 필요합니다. 메일함을 확인해주세요.";
  if (msg.includes("Too many requests")) return "너무 많은 시도입니다. 잠시 후 다시 시도해주세요.";
  return msg;
};
