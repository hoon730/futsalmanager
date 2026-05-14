import { useState } from "react";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";

export const AuthPage = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* 배경 글로우 */}
      <div className="fixed top-0 right-0 -z-10 w-64 h-64 bg-primary/10 blur-[100px] rounded-full" />
      <div className="fixed bottom-0 left-0 -z-10 w-80 h-80 bg-primary/5 blur-[120px] rounded-full" />

      <div className="w-full max-w-sm">
        {/* 헤더 */}
        <div className="mb-10">
          <p className="text-primary text-xs font-black uppercase tracking-[0.3em] mb-3">
            ⚽ Futsal Manager
          </p>
          <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">
            {mode === "login" ? "WELCOME\nBACK" : "JOIN\nNOW"}
          </h1>
          <div className="h-1 w-10 bg-primary mt-4 rounded-full shadow-[0_0_10px_#0df23e]" />
        </div>

        {/* 탭 */}
        <div className="flex bg-white/5 border border-white/5 rounded-2xl p-1 mb-8">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              mode === "login"
                ? "bg-primary text-black shadow-[0_0_12px_rgba(13,242,62,0.3)]"
                : "text-white/30 hover:text-white/60"
            }`}
          >
            로그인
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              mode === "signup"
                ? "bg-primary text-black shadow-[0_0_12px_rgba(13,242,62,0.3)]"
                : "text-white/30 hover:text-white/60"
            }`}
          >
            회원가입
          </button>
        </div>

        {mode === "login" ? (
          <LoginForm onSwitchToSignup={() => setMode("signup")} />
        ) : (
          <SignupForm onSwitchToLogin={() => setMode("login")} />
        )}
      </div>
    </div>
  );
};
