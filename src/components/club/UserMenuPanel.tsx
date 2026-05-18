import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "@/stores/authStore";
import { useSquadStore } from "@/stores/squadStore";
import { useFixedTeamStore } from "@/stores/fixedTeamStore";
import { useDivisionStore } from "@/stores/divisionStore";
import { supabase } from "@/lib/supabase";
import { shareSquadInvite, isKakaoReady } from "@/lib/kakaoShare";
import { KakaoIcon } from "@/components/icons/KakaoIcon";
import {
  loadSquadFromSupabase,
  loadFixedTeamsFromSupabase,
  loadDivisionsFromSupabase,
  loadTeammateHistoryFromSupabase,
} from "@/lib/supabaseSync";

interface Club {
  id: string;
  name: string;
  invite_code: string;
  role: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const UserMenuPanel = ({ isOpen, onClose }: Props) => {
  const { user, profile, signOut } = useAuthStore();
  const { squad, clearSquad, setSquad } = useSquadStore();
  const { setFixedTeams } = useFixedTeamStore();
  const { setDivisionHistory, updateTeammateHistory } = useDivisionStore();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<"idle" | "input" | "deleting">("idle");
  const [deleteInput, setDeleteInput] = useState("");

  useEffect(() => {
    if (!isOpen || !user) return;
    supabase
      .from("squad_members")
      .select("role, squads(id, name, invite_code)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!data) return;
        const list = data.map((row) => {
          const squad = Array.isArray(row.squads) ? row.squads[0] : row.squads;
          return {
            id: squad.id as string,
            name: squad.name as string,
            invite_code: squad.invite_code as string,
            role: row.role as string,
          };
        });
        setClubs(list);
      });
  }, [isOpen, user]);

  const handleCopyCode = () => {
    const current = clubs.find((c) => c.id === squad?.id);
    if (!current) return;
    navigator.clipboard.writeText(current.invite_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRegenerateCode = async () => {
    if (!squad?.id) return;
    setRegenerating(true);
    try {
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await supabase.from("squads").update({ invite_code: newCode }).eq("id", squad.id);
      setClubs((prev) => prev.map((c) => c.id === squad.id ? { ...c, invite_code: newCode } : c));
    } finally {
      setRegenerating(false);
    }
  };

  const handleSwitchClub = async (club: Club) => {
    const [fullSquad, fixedTeams, divisions, history] = await Promise.all([
      loadSquadFromSupabase(club.id),
      loadFixedTeamsFromSupabase(club.id),
      loadDivisionsFromSupabase(club.id),
      loadTeammateHistoryFromSupabase(club.id),
    ]);
    if (fullSquad) {
      setSquad(fullSquad);
      setFixedTeams(fixedTeams);
      setDivisionHistory(divisions);
      updateTeammateHistory(history);
    }
    onClose();
  };

  const handleDeleteClub = async () => {
    if (!squad?.id) return;
    setDeleteConfirm("deleting");
    try {
      const { error } = await supabase.from("squads").delete().eq("id", squad.id);
      if (error) throw error;
      setDeleteConfirm("idle");
      setDeleteInput("");
      clearSquad();
      onClose();
    } catch {
      setDeleteConfirm("input");
    }
  };

  const handleLeaveClub = async () => {
    if (!user || !squad?.id) return;
    await supabase
      .from("squad_members")
      .delete()
      .eq("user_id", user.id)
      .eq("squad_id", squad.id);
    setLeaveConfirm(false);
    clearSquad();
    onClose();
  };

  const handleSignOut = async () => {
    onClose();
    clearSquad();
    await signOut();
  };

  const currentClub = clubs.find((c) => c.id === squad?.id);
  const isOwner = currentClub?.role === "owner";
  const avatarLetter = (profile?.username || user?.email || "?")[0].toUpperCase();

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto" style={{ animation: "slideUp 0.25s ease-out" }}>
        <div className="rounded-t-[2.5rem] px-5 pt-5 pb-10 bg-[#1a1a1a] border-t border-white/5">
          {/* 핸들 */}
          <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-6" />

          {/* 계정 헤더 */}
          <div className="flex items-center gap-3 mb-6 px-1">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-black text-primary">{avatarLetter}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-base uppercase tracking-wide truncate">
                {profile?.username || "사용자"}
              </p>
              <p className="text-white/30 text-xs truncate mt-0.5">{user?.email}</p>
            </div>
          </div>

          {/* === CURRENT SQUAD === */}
          {currentClub && (
            <>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 px-1">현재 동호회</p>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4 mb-5">
                {/* 동호회 이름 + 권한 */}
                <div className="flex items-center justify-between gap-3">
                  <p className="text-white font-black text-base uppercase tracking-wide truncate">{currentClub.name}</p>
                  <span className="flex-shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{ background: isOwner ? "rgba(13,242,62,0.12)" : "rgba(255,255,255,0.05)", color: isOwner ? "#0DF23E" : "rgba(255,255,255,0.5)" }}>
                    {isOwner ? "운영자" : "멤버"}
                  </span>
                </div>

                {/* 초대 코드 */}
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-3">초대 코드</p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-2xl font-black tracking-[0.4em] font-mono text-primary">
                      {currentClub.invite_code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleCopyCode}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-wider transition-all active:scale-95"
                      >
                        <span className="material-icons text-sm">{copiedCode ? "check" : "content_copy"}</span>
                        {copiedCode ? "복사됨" : "복사"}
                      </button>
                      {isKakaoReady() && (
                        <button
                          onClick={() => shareSquadInvite(currentClub.name, currentClub.invite_code)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
                          style={{ background: "#fee500", color: "#3c1e1e" }}
                        >
                          <KakaoIcon size={14} />
                          공유
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-white/25 text-[10px] mt-2.5 leading-relaxed">멤버에게 이 코드를 공유하면 동호회에 참가할 수 있습니다</p>
                  {isOwner && (
                    <button
                      onClick={handleRegenerateCode}
                      disabled={regenerating}
                      className="mt-3 text-white/25 hover:text-white/50 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors disabled:opacity-40"
                    >
                      <span className="material-icons text-xs">refresh</span>
                      {regenerating ? "재생성 중..." : "코드 재생성"}
                    </button>
                  )}
                </div>

                {/* 위험 액션 — 카드 하단 작은 텍스트 링크 */}
                <div className="mt-4 pt-4 border-t border-white/5">
                  {isOwner ? (
                    deleteConfirm === "input" || deleteConfirm === "deleting" ? (
                      <div className="space-y-2">
                        <p className="text-xs text-red-400/80 font-bold leading-relaxed">
                          정말 <span className="font-black">{currentClub.name}</span>을 삭제하시겠어요?<br />
                          <span className="text-[10px] text-red-400/60 font-bold">멤버, 경기, 댓글, 공지 등 모든 데이터가 영구 삭제됩니다.</span>
                        </p>
                        <input
                          autoFocus
                          type="text"
                          value={deleteInput}
                          onChange={(e) => setDeleteInput(e.target.value)}
                          placeholder={`확인을 위해 "${currentClub.name}" 입력`}
                          className="w-full bg-black/20 border border-red-500/20 rounded-lg px-3 py-2 text-xs font-bold text-white placeholder-white/20 outline-none focus:border-red-500/50"
                          disabled={deleteConfirm === "deleting"}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setDeleteConfirm("idle"); setDeleteInput(""); }}
                            disabled={deleteConfirm === "deleting"}
                            className="flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest text-white/40 disabled:opacity-40"
                            style={{ background: "rgba(255,255,255,0.05)" }}
                          >
                            취소
                          </button>
                          <button
                            onClick={handleDeleteClub}
                            disabled={deleteInput !== currentClub.name || deleteConfirm === "deleting"}
                            className="flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest text-white disabled:opacity-30"
                            style={{ background: "rgba(239,68,68,0.7)" }}
                          >
                            {deleteConfirm === "deleting" ? "삭제 중..." : "삭제"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm("input")}
                        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-colors"
                        style={{ color: "rgba(239,68,68,0.55)" }}
                      >
                        <span className="material-icons text-xs">delete_forever</span>
                        동호회 삭제
                      </button>
                    )
                  ) : (
                    leaveConfirm ? (
                      <div className="space-y-2">
                        <p className="text-xs text-red-400/80 font-bold text-center">
                          정말 <span className="font-black">{currentClub.name}</span>에서 탈퇴할까요?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setLeaveConfirm(false)}
                            className="flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest text-white/40"
                            style={{ background: "rgba(255,255,255,0.05)" }}
                          >
                            취소
                          </button>
                          <button
                            onClick={handleLeaveClub}
                            className="flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest text-white"
                            style={{ background: "rgba(239,68,68,0.6)" }}
                          >
                            탈퇴
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setLeaveConfirm(true)}
                        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-colors"
                        style={{ color: "rgba(239,68,68,0.55)" }}
                      >
                        <span className="material-icons text-xs">exit_to_app</span>
                        동호회 탈퇴
                      </button>
                    )
                  )}
                </div>
              </div>
            </>
          )}

          {/* === SWITCH SQUAD === */}
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 px-1">동호회 전환</p>
          <div className="space-y-2 mb-5">
            {clubs
              .filter((c) => c.id !== squad?.id)
              .map((club) => (
                <button
                  key={club.id}
                  onClick={() => handleSwitchClub(club)}
                  className="w-full flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] hover:border-white/10 rounded-xl px-4 py-3 transition-all text-left active:scale-[0.98]"
                >
                  <span className="material-icons text-white/30 text-sm">sports_soccer</span>
                  <span className="text-white/80 text-sm font-bold flex-1 uppercase tracking-wide truncate">{club.name}</span>
                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{ background: club.role === "owner" ? "rgba(13,242,62,0.10)" : "rgba(255,255,255,0.04)", color: club.role === "owner" ? "rgba(13,242,62,0.7)" : "rgba(255,255,255,0.4)" }}>
                    {club.role === "owner" ? "운영자" : "멤버"}
                  </span>
                </button>
              ))}
            <button
              onClick={() => { clearSquad(); onClose(); }}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 transition-all text-left active:scale-[0.98] border border-dashed"
              style={{ borderColor: "rgba(255,255,255,0.10)" }}
            >
              <span className="material-icons text-white/30 text-sm">add</span>
              <span className="text-white/50 text-xs font-black uppercase tracking-widest">다른 동호회 참가 / 만들기</span>
            </button>
          </div>

          {/* === 로그아웃 — 하단 작은 텍스트 링크 === */}
          <div className="flex justify-center pt-2">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-white/35 hover:text-white/60 text-[11px] font-black uppercase tracking-wider transition-colors active:scale-95"
            >
              로그아웃
              <span className="material-icons text-xs">logout</span>
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
