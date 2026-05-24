import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toFriendlyMessage } from "@/lib/errorMessage";
import { useAuthStore } from "@/stores/authStore";
import { useSquadStore } from "@/stores/squadStore";
import { useFixedTeamStore } from "@/stores/fixedTeamStore";
import { useDivisionStore } from "@/stores/divisionStore";
import {
  loadSquadFromSupabase,
  loadFixedTeamsFromSupabase,
  loadDivisionsFromSupabase,
  loadTeammateHistoryFromSupabase,
} from "@/lib/supabaseSync";

type Mode = "select" | "create" | "join";

interface MyClub {
  id: string;
  name: string;
  role: string;
  createdAt: string;
}

export const ClubSetupPage = () => {
  // 초대 코드 우선순위:
  //   1) localStorage('pendingInviteCode') — main.tsx 에서 카카오 카드 진입 시 저장
  //   2) URL ?invite= — 직접 링크로 들어온 경우
  const { user } = useAuthStore();
  const { setSquad } = useSquadStore();
  const { setFixedTeams } = useFixedTeamStore();
  const { setDivisionHistory, updateTeammateHistory } = useDivisionStore();
  const [myClubs, setMyClubs] = useState<MyClub[]>([]);
  const [myClubsLoading, setMyClubsLoading] = useState(true);
  const [selectingClubId, setSelectingClubId] = useState<string | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<MyClub | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  // 로그인된 유저의 기존 동호회 목록 조회
  // nested join(squads(id,name))은 squads RLS에 걸려 data:null이 될 수 있으므로
  // squad_members → squads 두 단계로 분리해 안정적으로 조회
  useEffect(() => {
    if (!user) { setMyClubsLoading(false); return; }

    const fetchMyClubs = async () => {
      try {
        // 1) 내 squad_id + role 목록 조회
        const { data: memberships } = await supabase
          .from("squad_members")
          .select("squad_id, role")
          .eq("user_id", user.id);

        if (!memberships || memberships.length === 0) return;

        // 2) squad 이름 + 생성일 조회
        const { data: squads } = await supabase
          .from("squads")
          .select("id, name, created_at")
          .in("id", memberships.map((m) => m.squad_id));

        if (squads && squads.length > 0) {
          const roleMap = Object.fromEntries(memberships.map((m) => [m.squad_id, m.role]));
          setMyClubs(
            squads.map((s) => ({
              id: s.id as string,
              name: s.name as string,
              role: roleMap[s.id] ?? "member",
              createdAt: s.created_at as string,
            }))
          );
        }
      } catch (e) {
        console.error("기존 동호회 목록 조회 실패:", e);
      } finally {
        setMyClubsLoading(false);
      }
    };

    fetchMyClubs();
  }, [user]);

  // 기존 동호회 선택 시 전체 데이터 로드 후 앱으로 진입
  const handleSelectMyClub = async (clubId: string) => {
    setSelectingClubId(clubId);
    try {
      const [fullSquad, fixedTeams, divisions, history] = await Promise.all([
        loadSquadFromSupabase(clubId),
        loadFixedTeamsFromSupabase(clubId),
        loadDivisionsFromSupabase(clubId),
        loadTeammateHistoryFromSupabase(clubId),
      ]);
      if (fullSquad) {
        setSquad(fullSquad);
        setFixedTeams(fixedTeams);
        setDivisionHistory(divisions);
        updateTeammateHistory(history);
      }
    } finally {
      setSelectingClubId(null);
    }
  };

  // 동호회 탈퇴 (leave_squad RPC: 마지막 멤버면 삭제, owner면 자동 위임)
  const handleLeaveMyClub = async (club: MyClub) => {
    if (!user) return;
    setLeavingId(club.id);
    try {
      if (club.role === "owner") {
        // owner는 squad 자체를 삭제
        const { error } = await supabase.from("squads").delete().eq("id", club.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("leave_squad", { p_squad_id: club.id });
        if (error) throw error;
      }
      setMyClubs((prev) => prev.filter((c) => c.id !== club.id));
      setLeaveTarget(null);
    } catch (e) {
      alert(toFriendlyMessage(e, "탈퇴에 실패했습니다"));
    } finally {
      setLeavingId(null);
    }
  };

  const [initialInviteCode] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      const stored = localStorage.getItem("pendingInviteCode");
      if (stored && stored.length > 0) return stored.toUpperCase();
    } catch { /* ignore */ }
    const fromUrl = new URLSearchParams(window.location.search).get("invite");
    return fromUrl ? fromUrl.toUpperCase() : "";
  });
  const [mode, setMode] = useState<Mode>(initialInviteCode ? "join" : "select");

  // 사용 완료: localStorage + URL 정리 (새로고침 시 재진입 방지)
  useEffect(() => {
    if (!initialInviteCode) return;
    try { localStorage.removeItem("pendingInviteCode"); } catch { /* ignore */ }
    const url = new URL(window.location.href);
    url.searchParams.delete("invite");
    window.history.replaceState({}, "", url.toString());
  }, [initialInviteCode]);

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
            {mode === "select" && "MY\nCLUB"}
            {mode === "create" && "NEW\nCLUB"}
            {mode === "join" && "JOIN\nCLUB"}
          </h1>
          <div className="h-1 w-10 bg-primary mt-4 rounded-full shadow-[0_0_10px_#0df23e]" />
        </div>

        {mode === "select" && (
          <ModeSelect
            onSelect={setMode}
            myClubs={myClubs}
            myClubsLoading={myClubsLoading}
            selectingClubId={selectingClubId}
            onSelectMyClub={handleSelectMyClub}
            onLeaveMyClub={setLeaveTarget}
          />
        )}

        {/* 탈퇴/삭제 확인 다이얼로그 */}
        {leaveTarget && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center px-6 z-50"
            onClick={() => setLeaveTarget(null)}
          >
            <div
              className="w-full max-w-sm rounded-[2.5rem] p-8"
              style={{ background: "rgba(22,38,27,0.95)", border: "2px solid rgba(239,68,68,0.3)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-black italic uppercase text-white mb-2">
                {leaveTarget.role === "owner" ? "동호회 삭제" : "동호회 탈퇴"}
              </h3>
              <p className="text-sm text-white/60 leading-relaxed mb-8">
                <span className="text-white font-bold">"{leaveTarget.name}"</span>
                {leaveTarget.role === "owner"
                  ? "을(를) 삭제하시겠습니까?\n운영자가 삭제하면 동호회와 모든 데이터가 영구 삭제됩니다."
                  : "에서 탈퇴하시겠습니까?"}
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => handleLeaveMyClub(leaveTarget)}
                  disabled={leavingId !== null}
                  className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40"
                  style={{ backgroundColor: "#ef4444", color: "#fff" }}
                >
                  {leavingId ? "처리 중..." : leaveTarget.role === "owner" ? "삭제하기" : "탈퇴하기"}
                </button>
                <button
                  onClick={() => setLeaveTarget(null)}
                  className="w-full py-3.5 rounded-xl text-sm font-black uppercase tracking-[0.2em] text-white/60"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  뒤로가기
                </button>
              </div>
            </div>
          </div>
        )}
        {mode === "create" && <CreateClub onBack={() => setMode("select")} />}
        {mode === "join" && <JoinClub onBack={() => setMode("select")} initialCode={initialInviteCode} />}
      </div>
    </div>
  );
};

interface ModeSelectProps {
  onSelect: (m: Mode) => void;
  myClubs: MyClub[];
  myClubsLoading: boolean;
  selectingClubId: string | null;
  onSelectMyClub: (clubId: string) => void;
  onLeaveMyClub: (club: MyClub) => void;
}

const ModeSelect = ({ onSelect, myClubs, myClubsLoading, selectingClubId, onSelectMyClub, onLeaveMyClub }: ModeSelectProps) => (
  <div className="space-y-3">
    {/* 기존 동호회 목록 */}
    {myClubsLoading ? (
      <div className="py-4 flex justify-center">
        <div className="loading-spinner" style={{ width: 20, height: 20 }} />
      </div>
    ) : myClubs.length > 0 ? (
      <div className="mb-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 px-1">내 동호회</p>
        <div className="space-y-2">
          {myClubs.map((club) => (
            <div key={club.id} className="relative">
              <button
                onClick={() => onSelectMyClub(club.id)}
                disabled={selectingClubId !== null}
                className="w-full bg-white/5 border border-white/5 hover:border-primary/40 rounded-2xl p-4 text-left transition-all group active:scale-[0.98] disabled:opacity-60 pr-12"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="material-icons text-primary text-base">sports_soccer</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-black text-sm uppercase tracking-wide truncate group-hover:text-primary transition-colors">
                      {club.name}
                    </p>
                  </div>
                  {selectingClubId === club.id ? (
                    <div className="loading-spinner flex-shrink-0" style={{ width: 16, height: 16 }} />
                  ) : (
                    <span className="material-icons text-white/20 group-hover:text-primary/50 transition-colors flex-shrink-0">
                      chevron_right
                    </span>
                  )}
                </div>
              </button>
              {/* 탈퇴/삭제 버튼 */}
              <button
                onClick={(e) => { e.stopPropagation(); onLeaveMyClub(club); }}
                disabled={selectingClubId !== null}
                className="absolute top-1/2 -translate-y-1/2 right-2 w-8 h-8 flex items-center justify-center rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title={club.role === "owner" ? "동호회 삭제" : "동호회 탈퇴"}
              >
                <span className="material-icons text-sm">
                  {club.role === "owner" ? "delete_outline" : "logout"}
                </span>
              </button>
            </div>
          ))}
        </div>
        <div className="h-px bg-white/5 my-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2 px-1">새로 시작하기</p>
      </div>
    ) : null}

    <button
      onClick={() => onSelect("create")}
      className="w-full bg-white/5 border border-white/5 hover:border-primary/40 rounded-2xl p-5 text-left transition-all group active:scale-[0.98]"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <span className="material-icons text-primary">add_circle</span>
        </div>
        <div>
          <p className="text-white font-black text-sm uppercase tracking-wide group-hover:text-primary transition-colors">
            새 동호회 만들기
          </p>
          <p className="text-white/30 text-xs mt-0.5">직접 동호회를 개설합니다</p>
        </div>
        <span className="material-icons text-white/20 group-hover:text-primary/50 transition-colors ml-auto">
          chevron_right
        </span>
      </div>
    </button>

    <button
      onClick={() => onSelect("join")}
      className="w-full bg-white/5 border border-white/5 hover:border-white/20 rounded-2xl p-5 text-left transition-all group active:scale-[0.98]"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
          <span className="material-icons text-white/50">link</span>
        </div>
        <div>
          <p className="text-white font-black text-sm uppercase tracking-wide">
            초대 코드로 참가
          </p>
          <p className="text-white/30 text-xs mt-0.5">운영자에게 코드를 받아 참가</p>
        </div>
        <span className="material-icons text-white/20 ml-auto">chevron_right</span>
      </div>
    </button>
  </div>
);

const CreateClub = ({ onBack }: { onBack: () => void }) => {
  const { user } = useAuthStore();
  const { setSquad } = useSquadStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    setError("");

    try {
      const squadId = `squad_${Date.now()}`;
      // RPC: squad + owner squad_member를 단일 트랜잭션으로 생성 (고아 squad 방지)
      const { data: squad, error: squadErr } = await supabase
        .rpc("create_squad_with_owner", {
          p_squad_id: squadId,
          p_name: name,
          p_description: description || null,
        })
        .single();

      if (squadErr) throw squadErr;
      if (!squad) throw new Error("동호회 생성 실패");

      setSquad({
        id: (squad as { id: string }).id,
        name: (squad as { name: string }).name,
        members: [],
        createdAt: (squad as { created_at: string }).created_at,
      });
    } catch (err: unknown) {
      setError(toFriendlyMessage(err, "동호회 생성에 실패했습니다"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleCreate} className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-white/30 hover:text-white text-xs font-black uppercase tracking-widest transition-colors mb-2"
      >
        <span className="material-icons text-sm">arrow_back</span>
        뒤로
      </button>

      <div>
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">
          동호회 이름
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 강남 풋살 FC"
          required
          maxLength={30}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-primary/50 focus:bg-white/8"
        />
      </div>

      <div>
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">
          소개 <span className="text-white/20 normal-case tracking-normal font-medium">(선택)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="동호회를 한 줄로 소개해주세요"
          maxLength={100}
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-primary/50 resize-none"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs font-medium">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !name.trim()}
        className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: "#0DF23E", color: "#0a150d" }}
      >
        {isLoading ? "생성 중..." : "동호회 만들기"}
      </button>
    </form>
  );
};

const JoinClub = ({ onBack, initialCode = "" }: { onBack: () => void; initialCode?: string }) => {
  const { user } = useAuthStore();
  const { setSquad } = useSquadStore();
  const { setFixedTeams } = useFixedTeamStore();
  const { setDivisionHistory, updateTeammateHistory } = useDivisionStore();
  const [code, setCode] = useState(initialCode);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    setError("");

    try {
      // RLS 우회용 함수 호출 (가입 전이라도 invite_code로 squad 조회 가능)
      const { data: squadList, error: squadErr } = await supabase
        .rpc("find_squad_by_invite_code", { p_code: code.toUpperCase().trim() });

      const squad = Array.isArray(squadList) ? squadList[0] : null;

      if (squadErr || !squad) {
        setError("유효하지 않은 초대 코드입니다.");
        return;
      }

      const { error: memberErr } = await supabase.from("squad_members").insert({
        squad_id: squad.id,
        user_id: user.id,
        role: "member",
      });

      // 23505 = unique_violation (이미 가입된 squad). 그 외 에러는 throw.
      if (memberErr && memberErr.code !== "23505") throw memberErr;

      // 전체 데이터 로드 (멤버, 고정팀, 이력 포함)
      const [fullSquad, fixedTeams, divisions, history] = await Promise.all([
        loadSquadFromSupabase(squad.id),
        loadFixedTeamsFromSupabase(squad.id),
        loadDivisionsFromSupabase(squad.id),
        loadTeammateHistoryFromSupabase(squad.id),
      ]);

      if (fullSquad) {
        setSquad(fullSquad);
        setFixedTeams(fixedTeams);
        setDivisionHistory(divisions);
        updateTeammateHistory(history);
      }
    } catch (err: unknown) {
      setError(toFriendlyMessage(err, "참가에 실패했습니다"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleJoin} className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-white/30 hover:text-white text-xs font-black uppercase tracking-widest transition-colors mb-2"
      >
        <span className="material-icons text-sm">arrow_back</span>
        뒤로
      </button>

      <div>
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">
          초대 코드
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="A1B2C3"
          required
          maxLength={6}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder-white/20 outline-none transition-all focus:border-primary/50 text-center text-2xl font-black tracking-[0.4em] uppercase font-mono"
        />
        <p className="text-white/20 text-[10px] font-medium mt-2 text-center uppercase tracking-widest">
          운영자에게 6자리 코드를 요청하세요
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs font-medium">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || code.length < 4}
        className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: "#0DF23E", color: "#0a150d" }}
      >
        {isLoading ? "참가 중..." : "참가하기"}
      </button>
    </form>
  );
};
