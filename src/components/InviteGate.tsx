import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";

interface Props {
  onJoin: () => void;
  onDismiss: () => void;
}

/**
 * 카카오 초대 링크(?invite=CODE)로 진입한 사용자가
 * 이미 동호회에 속해 있는 경우 하단 시트로 가입 여부를 묻는 컴포넌트.
 *
 * - localStorage "pendingInviteCode" 를 읽어 코드 확인
 * - 유효한 코드면 동호회명을 표시하고 "가입하기" / "나중에" 제공
 * - "가입하기" → onJoin() → 부모에서 clearSquad() → ClubSetupPage가 코드 자동 입력 처리
 * - "나중에"  → onDismiss() → localStorage 코드 삭제 후 닫힘
 */
export function InviteGate({ onJoin, onDismiss }: Props) {
  const [code] = useState<string | null>(() => {
    try { return localStorage.getItem("pendingInviteCode"); } catch { return null; }
  });
  const [squadName, setSquadName] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let mounted = true;
    supabase
      .rpc("find_squad_by_invite_code", { p_code: code })
      .then(({ data }) => {
        if (!mounted) return;
        const s = Array.isArray(data) ? data[0] : null;
        if (s?.name) setSquadName(s.name);
        else onDismiss(); // 유효하지 않은 코드 → 조용히 닫기
      });
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 코드 없거나 아직 조회 중이면 아무것도 렌더하지 않음
  if (!code || !squadName) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-end justify-center z-[9990]">
      {/* 배경 딤 */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onDismiss}
      />
      {/* 하단 시트 */}
      <div
        className="relative w-full max-w-sm rounded-t-3xl p-6"
        style={{ background: "rgba(22,28,22,0.98)", border: "1px solid rgba(13,242,62,0.15)" }}
      >
        {/* 핸들 바 */}
        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-5" />

        {/* 동호회 정보 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="material-icons text-primary text-base">sports_soccer</span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-0.5">
              동호회 초대
            </p>
            <p className="text-white font-black text-base leading-tight">{squadName}</p>
          </div>
        </div>

        <p className="text-white/40 text-xs mb-5 leading-relaxed">
          초대 코드{" "}
          <span className="text-white/70 font-bold tracking-[0.2em] font-mono">{code}</span>
          {" "}로 이 동호회에 초대받으셨습니다.
          <br />가입하면 현재 동호회에서 이동됩니다.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest bg-white/5 border border-white/10 text-white/40 transition-all active:scale-95"
          >
            나중에
          </button>
          <button
            onClick={onJoin}
            className="flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
            style={{ backgroundColor: "#0DF23E", color: "#0a150d" }}
          >
            가입하기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
