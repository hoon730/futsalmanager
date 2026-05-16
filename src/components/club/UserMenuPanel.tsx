import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "@/stores/authStore";
import { useSquadStore } from "@/stores/squadStore";
import { useFixedTeamStore } from "@/stores/fixedTeamStore";
import { useDivisionStore } from "@/stores/divisionStore";
import { supabase } from "@/lib/supabase";
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

  useEffect(() => {
    if (!isOpen || !user) return;
    supabase
      .from("squad_members")
      .select("role, squads(id, name, invite_code)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!data) return;
        const list = data.map((row: any) => ({
          id: row.squads.id,
          name: row.squads.name,
          invite_code: row.squads.invite_code,
          role: row.role,
        }));
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

          {/* 유저 정보 */}
          <div className="flex items-center gap-4 mb-6 px-1">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-black text-primary">{avatarLetter}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-base uppercase tracking-wide truncate">
                {profile?.username || "사용자"}
              </p>
              <p className="text-white/30 text-xs truncate mt-0.5">{user?.email}</p>
            </div>
          </div>

          {/* 현재 동호회 + 초대코드 */}
          {currentClub && (
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-1.5">
                현재 동호회
              </p>
              <p className="text-white font-black text-base uppercase tracking-wide">
                {currentClub.name}
              </p>
              {isOwner && (
                <button
                  onClick={handleCopyCode}
                  className="mt-3 flex items-center gap-2 w-full bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5 transition-all hover:bg-primary/10 active:scale-[0.98]"
                >
                  <span className="font-mono text-primary font-black tracking-[0.3em] text-sm flex-1 text-left">
                    {currentClub.invite_code}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">
                    {copiedCode ? "복사됨!" : "초대코드"}
                  </span>
                  <span className="material-icons text-primary/40 text-sm">
                    {copiedCode ? "check" : "content_copy"}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* 다른 동호회 전환 */}
          {clubs.filter((c) => c.id !== squad?.id).length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-2 px-1">
                내 동호회
              </p>
              <div className="space-y-2">
                {clubs
                  .filter((c) => c.id !== squad?.id)
                  .map((club) => (
                    <button
                      key={club.id}
                      onClick={() => handleSwitchClub(club)}
                      className="w-full flex items-center gap-3 bg-white/5 border border-white/5 hover:border-white/10 rounded-xl px-4 py-3 transition-all text-left active:scale-[0.98]"
                    >
                      <span className="material-icons text-white/20 text-sm">sports_soccer</span>
                      <span className="text-white/70 text-sm font-bold flex-1 uppercase tracking-wide">{club.name}</span>
                      <span className="text-white/20 text-[10px] font-black uppercase tracking-widest">
                        {club.role === "owner" ? "운영자" : "멤버"}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* 동호회 탈퇴 */}
          {currentClub && (
            isOwner ? (
              <div className="w-full flex items-center gap-3 rounded-xl px-4 py-3 mb-2"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="material-icons text-white/15 text-sm">exit_to_app</span>
                <span className="text-white/20 text-xs font-black uppercase tracking-widest flex-1">동호회 탈퇴</span>
                <span className="text-[9px] text-white/20 font-black uppercase tracking-widest">운영자는 탈퇴 불가</span>
              </div>
            ) : leaveConfirm ? (
              <div className="rounded-xl p-3 mb-2 space-y-2"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
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
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 mb-2 transition-all text-left active:scale-[0.98]"
                style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.1)" }}
              >
                <span className="material-icons text-sm" style={{ color: "rgba(239,68,68,0.5)" }}>exit_to_app</span>
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: "rgba(239,68,68,0.6)" }}>
                  동호회 탈퇴
                </span>
              </button>
            )
          )}

          {/* 다른 동호회 참가/생성 */}
          <button
            onClick={() => { clearSquad(); onClose(); }}
            className="w-full flex items-center gap-3 bg-white/5 border border-white/5 hover:border-white/10 rounded-xl px-4 py-3 mb-2 transition-all text-left active:scale-[0.98]"
          >
            <span className="material-icons text-white/20 text-sm">add_circle_outline</span>
            <span className="text-white/40 text-xs font-black uppercase tracking-widest">다른 동호회 참가 / 만들기</span>
          </button>

          {/* 로그아웃 */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 rounded-xl px-4 py-3 transition-all text-left active:scale-[0.98]"
          >
            <span className="material-icons text-red-500/50 text-sm">logout</span>
            <span className="text-red-400/70 text-xs font-black uppercase tracking-widest">로그아웃</span>
          </button>
        </div>
      </div>
    </>,
    document.body
  );
};
