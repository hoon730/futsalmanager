import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSquadStore } from "@/stores/squadStore";
import { useMatchStore } from "@/stores/matchStore";
import { useAuthStore } from "@/stores/authStore";
import { useDivisionStore } from "@/stores/divisionStore";
import { useAnnouncementStore } from "@/stores/announcementStore";
import { supabase } from "@/lib/supabase";
import { toast } from "@/stores/toastStore";
import { toFriendlyMessage } from "@/lib/errorMessage";
import type { IMatch } from "@/types";
import { MatchCard } from "@/components/schedule/MatchCard";
import { MatchDetailSheet } from "@/components/schedule/MatchDetailSheet";
import { MatchFormModal } from "@/components/schedule/MatchFormModal";

// ─── SchedulePage ─────────────────────────────────────────────────────────────

export default function SchedulePage({ onGoToDivision }: { onGoToDivision: () => void }) {
  const { squad, clearAllParticipants, toggleParticipant } = useSquadStore();
  const { user, profile } = useAuthStore();
  const {
    matches, attendees, comments, isLoading, matchMercenaries,
    loadMatches, loadAttendees, loadComments, loadMercenaries,
    createMatch, deleteMatch, setAttendance,
    addComment, updateComment, deleteComment,
    addMatchMercenary, removeMatchMercenary,
    updateMatch,
  } = useMatchStore();

  const { divisionHistory } = useDivisionStore();
  const { announcements, loadAnnouncements, addAnnouncement, updateAnnouncement, deleteAnnouncement, togglePin } = useAnnouncementStore();

  const [userRole, setUserRole] = useState<string>("member");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [pastPage, setPastPage] = useState(1);
  const [selectedMatch, setSelectedMatch] = useState<IMatch | null>(null);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [noticeMode, setNoticeMode] = useState<"list" | "write">("list");
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [newNotice, setNewNotice] = useState("");
  const [noticeLoading, setNoticeLoading] = useState(false);

  const PAST_PAGE_SIZE = 5;

  // matches가 바뀔 때만 재계산 (매 렌더마다 filter 2회 + Date 호출 피함)
  const { upcoming, past } = useMemo(() => {
    const nowTs = Date.now();
    const up: IMatch[] = [];
    const pst: IMatch[] = [];
    for (const m of matches) {
      if (new Date(m.matchDate).getTime() >= nowTs) up.push(m);
      else pst.push(m);
    }
    pst.reverse();
    return { upcoming: up, past: pst };
  }, [matches]);

  const pastTotalPages = Math.ceil(past.length / PAST_PAGE_SIZE);
  const pagedPast = useMemo(
    () => past.slice((pastPage - 1) * PAST_PAGE_SIZE, pastPage * PAST_PAGE_SIZE),
    [past, pastPage],
  );
  const isAdmin = userRole === "owner" || userRole === "admin";

  useEffect(() => {
    if (!squad?.id) return;
    loadMatches(squad.id);
    loadAnnouncements(squad.id);
  }, [squad?.id]);

  // 공지 모달 ESC 닫기
  useEffect(() => {
    if (!showAllAnnouncements) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAllAnnouncements(false);
        setNoticeMode("list");
        setNewNotice("");
        setEditingNoticeId(null);
        setOpenMenuId(null);
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [showAllAnnouncements]);

  // loadMatches가 한 번에 attendees까지 로드하므로 별도 N+1 effect 불필요.
  // createMatch 직후 새 match만 attendees 비어있을 수 있으니 보강.
  const matchIdsKey = matches.map((m) => m.id).join(",");
  useEffect(() => {
    matches.forEach((m) => { if (!attendees[m.id]) loadAttendees(m.id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchIdsKey]);

  useEffect(() => {
    if (!user || !squad?.id) return;
    // squad 전환 시 이전 동호회의 role이 잠깐 노출되지 않도록 즉시 초기화
    setUserRole("member");
    let cancelled = false;
    supabase
      .from("squad_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("squad_id", squad.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setUserRole(data.role);
      });
    return () => { cancelled = true; };
  }, [user?.id, squad?.id]);

  const handleOpenDetail = (match: IMatch) => {
    setSelectedMatch(match);
    loadAttendees(match.id);
    loadComments(match.id);
    loadMercenaries(match.id);
  };

  const handleCloseDetail = () => setSelectedMatch(null);

  // 푸시 알림 클릭 진입: URL의 ?match=<id> 를 읽어 매치가 로드되면 상세 시트 자동 오픈.
  // 한 번 처리한 뒤 URL을 정리해 새로고침/뒤로가기 시 재오픈되지 않게 함.
  const [pendingMatchId, setPendingMatchId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return new URLSearchParams(window.location.search).get("match");
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (!pendingMatchId) return;
    if (selectedMatch?.id === pendingMatchId) return; // 이미 열려있으면 skip
    if (matches.length === 0) return; // 매치 아직 로드 전 → 다음 렌더에서 재시도
    const target = matches.find((m) => m.id === pendingMatchId);
    if (target) handleOpenDetail(target);
    // 찾았든 못 찾았든 한 번 시도하면 정리 (없는 매치면 그냥 일정 목록만 보임)
    setPendingMatchId(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("match");
      url.searchParams.delete("tab");
      window.history.replaceState(null, "", url.pathname + (url.search || ""));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMatchId, matches]);

  const handleRSVP = async (status: "attending" | "absent" | "waitlist") => {
    if (!user || !selectedMatch) return;
    const linkedMemberId = user.user_metadata?.member_id as string | undefined;
    try {
      await setAttendance(selectedMatch.id, user.id, status, linkedMemberId);
    } catch (e) {
      console.error("[RSVP] setAttendance failed:", e);
      toast(toFriendlyMessage(e, "출석 응답을 저장하지 못했습니다"), "error");
    }
  };

  const getMyDisplayName = () => {
    const linkedMemberId = user?.user_metadata?.member_id as string | undefined;
    const linkedMember = squad?.members.find((m) => m.id === linkedMemberId);
    return linkedMember?.name ?? profile?.username ?? user?.email ?? "알 수 없음";
  };

  const handleAddComment = async (content: string, parentId?: string) => {
    if (!user || !selectedMatch) return;
    await addComment(selectedMatch.id, user.id, getMyDisplayName(), content, parentId);
  };

  const handleUpdateComment = async (commentId: string, content: string) => {
    if (!selectedMatch) return;
    await updateComment(commentId, selectedMatch.id, content);
  };

  const handleEditMatch = async (matchId: string, data: Partial<Omit<IMatch, "id" | "createdAt" | "squadId">>) => {
    await updateMatch(matchId, data);
    // selectedMatch 상태도 업데이트
    setSelectedMatch((prev) => prev ? { ...prev, ...data } : prev);
  };

  const handleGoToDivision = (match: IMatch) => {
    // 해당 경기 참석자를 squadStore에 로드
    const matchAtts = attendees[match.id] || [];
    const attendingIds = matchAtts
      .filter((a) => a.status === "attending" && a.memberId)
      .map((a) => a.memberId as string)
      .filter((id) => squad?.members.some((m) => m.id === id));
    clearAllParticipants();
    attendingIds.forEach((id) => toggleParticipant(id));
    // 시트 닫고 팀배정 탭으로
    handleCloseDetail();
    onGoToDivision();
  };

  return (
    <div className="animate-fade-in flex flex-col min-h-full">
      <header className="px-6 pt-12 pb-14">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">
              경기 일정
            </h1>
            <div className="h-1 w-8 bg-primary mt-3 rounded-full shadow-[0_0_10px_#0df23e]" />
          </div>
          {user && isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
              style={{ backgroundColor: "#0DF23E", color: "#0a150d" }}
            >
              <span className="material-icons text-xl">add</span>추가
            </button>
          )}
        </div>
      </header>

      {/* 공지사항 배너 */}
      {(announcements.length > 0 || isAdmin) && (
        <div className="px-6 mb-5">
          <div
            className="rounded-2xl border border-primary/20 overflow-hidden cursor-pointer active:opacity-80 transition-opacity"
            style={{ background: "rgba(13,242,62,0.04)" }}
            onClick={() => setShowAllAnnouncements(true)}
          >
            {announcements.length > 0 ? (
              <>
                {/* 핀 고정 or 최신 공지 1개 */}
                <div className="flex items-start gap-3 px-4 py-3">
                  {announcements[0].pinned ? (
                    <span className="material-icons text-primary text-base flex-shrink-0 mt-0.5">push_pin</span>
                  ) : (
                    <span className="material-icons text-primary/60 text-base flex-shrink-0 mt-0.5">campaign</span>
                  )}
                  <p className="text-sm text-white/80 flex-1 leading-relaxed line-clamp-2">
                    {announcements[0].content}
                  </p>
                  {announcements.length > 1 && (
                    <span className="text-[10px] font-black text-primary/60 flex-shrink-0 mt-0.5 uppercase tracking-widest">
                      +{announcements.length - 1}
                    </span>
                  )}
                </div>
                <div className="px-4 pb-2.5 flex items-center justify-between">
                  <span className="text-[10px] text-white/20">
                    {new Date(announcements[0].createdAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                    {announcements[0].pinned && (
                      <span className="ml-2 text-primary font-black">· 고정</span>
                    )}
                  </span>
                  <span className="text-[10px] font-black text-white/25 uppercase tracking-widest">
                    {announcements.length > 1 ? "전체 보기" : "탭하여 열기"}
                  </span>
                </div>
              </>
            ) : (
              /* 관리자 전용 — 공지 없을 때 작성 유도 */
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="material-icons text-primary/40 text-base flex-shrink-0">campaign</span>
                <p className="text-xs text-white/30 flex-1">공지사항을 작성해보세요</p>
                <span className="material-icons text-primary/40 text-sm">add</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 공지 모달 — 목록 / 작성 모드 분리 */}
      {showAllAnnouncements && createPortal(
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center px-6 z-[9999] animate-fade-in"
          onClick={() => { setShowAllAnnouncements(false); setNoticeMode("list"); setNewNotice(""); setEditingNoticeId(null); setOpenMenuId(null); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 overflow-y-auto"
            style={{ background: "rgba(22,28,22,0.98)", border: "1px solid rgba(13,242,62,0.15)", maxHeight: "85vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {noticeMode === "list" ? (
              <>
                {/* 헤더 */}
                <div className="flex items-center gap-2 mb-5">
                  <span className="material-icons text-primary text-lg">campaign</span>
                  <h3 className="text-lg font-black italic uppercase tracking-tighter text-white">공지사항</h3>
                </div>

                {/* 공지 목록 */}
                <div className="space-y-3 max-h-80 overflow-y-auto hide-scrollbar">
                  {announcements.length === 0 ? (
                    <p className="text-center text-white/20 text-xs py-10">등록된 공지가 없습니다</p>
                  ) : announcements.map((a) => (
                    <div
                      key={a.id}
                      className="p-4 rounded-2xl border"
                      style={{
                        background: a.pinned ? "rgba(13,242,62,0.05)" : "rgba(255,255,255,0.03)",
                        borderColor: a.pinned ? "rgba(13,242,62,0.2)" : "rgba(255,255,255,0.06)",
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          {a.pinned && (
                            <div className="flex items-center gap-1 mb-1.5">
                              <span className="material-icons text-primary/60 text-xs">push_pin</span>
                              <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest">고정</span>
                            </div>
                          )}
                          <p className="text-sm text-white/80 leading-relaxed">{a.content}</p>
                          <p className="text-[10px] text-white/25 mt-2">
                            {new Date(a.createdAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                          </p>
                        </div>
                        {/* 운영자 전용: 핀 + 삭제 */}
                        {isAdmin && (
                          <div className="flex gap-1 flex-shrink-0 -mr-1.5 -mt-1.5">
                            <button
                              onClick={() => togglePin(a.id, !a.pinned)}
                              className="w-7 h-7 flex items-center justify-center transition-all active:scale-90"
                              style={{ color: a.pinned ? "#0DF23E" : "rgba(255,255,255,0.2)" }}
                            >
                              <span className="material-icons" style={{ fontSize: "16px" }}>push_pin</span>
                            </button>
                            <div className="relative">
                              <button
                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === a.id ? null : a.id); }}
                                className="w-7 h-7 flex items-center justify-center transition-all active:scale-90 text-white/30 hover:text-white/60"
                              >
                                <span className="material-icons" style={{ fontSize: "16px" }}>more_vert</span>
                              </button>
                              {openMenuId === a.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }}
                                  />
                                  <div
                                    className="absolute right-0 top-7 z-20 rounded-lg overflow-hidden whitespace-nowrap shadow-lg"
                                    style={{ background: "rgba(28,34,28,0.98)", border: "1px solid rgba(255,255,255,0.08)" }}
                                  >
                                    <button
                                      onClick={() => {
                                        setEditingNoticeId(a.id);
                                        setNewNotice(a.content);
                                        setNoticeMode("write");
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-white/80 hover:bg-white/5 transition-colors"
                                    >
                                      <span className="material-icons" style={{ fontSize: "12px" }}>edit</span>
                                      수정
                                    </button>
                                    <button
                                      onClick={() => {
                                        deleteAnnouncement(a.id);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/5"
                                    >
                                      <span className="material-icons" style={{ fontSize: "12px" }}>delete</span>
                                      삭제
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 관리자 전용: 공지 작성 진입 버튼 */}
                {isAdmin && (
                  <button
                    onClick={() => setNoticeMode("write")}
                    className="w-full mt-5 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                    style={{ backgroundColor: "#0DF23E", color: "#0a150d" }}
                  >
                    <span className="material-icons text-base">add</span>
                    공지 작성
                  </button>
                )}

                {/* 닫기 */}
                <button
                  onClick={() => { setShowAllAnnouncements(false); setNoticeMode("list"); setNewNotice(""); setEditingNoticeId(null); setOpenMenuId(null); }}
                  className="w-full mt-2 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-white/40 border border-white/10"
                >
                  닫기
                </button>
              </>
            ) : (
              <>
                {/* 작성/수정 모드 헤더 */}
                <div className="flex items-center gap-2 mb-5">
                  <button
                    onClick={() => { setNoticeMode("list"); setNewNotice(""); setEditingNoticeId(null); }}
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    <span className="material-icons text-lg">arrow_back</span>
                  </button>
                  <h3 className="text-lg font-black italic uppercase tracking-tighter text-white">
                    {editingNoticeId ? "공지 수정" : "공지 작성"}
                  </h3>
                </div>

                {/* 작성/수정 폼 */}
                <div className="flex flex-col gap-3">
                  <textarea
                    value={newNotice}
                    onChange={(e) => setNewNotice(e.target.value)}
                    placeholder="공지 내용을 입력하세요"
                    rows={5}
                    autoFocus
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none resize-none focus:border-primary/50 transition-all"
                  />
                  <button
                    onClick={async () => {
                      if (!newNotice.trim() || !squad?.id || !user?.id) return;
                      setNoticeLoading(true);
                      try {
                        if (editingNoticeId) {
                          await updateAnnouncement(editingNoticeId, newNotice.trim());
                        } else {
                          await addAnnouncement(squad.id, newNotice.trim(), user.id);
                        }
                        setNewNotice("");
                        setEditingNoticeId(null);
                        setNoticeMode("list");
                      } finally { setNoticeLoading(false); }
                    }}
                    disabled={noticeLoading || !newNotice.trim()}
                    className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-30"
                    style={{ backgroundColor: "#0DF23E", color: "#0a150d" }}
                  >
                    {noticeLoading ? "저장 중..." : editingNoticeId ? "수정 완료" : "등록"}
                  </button>
                  <button
                    onClick={() => { setNoticeMode("list"); setNewNotice(""); setEditingNoticeId(null); }}
                    className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-white/40 border border-white/10"
                  >
                    취소
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      <main className="flex-1 px-6 pb-8 space-y-4">
        {isLoading && matches.length === 0 && (
          <div className="py-20 text-center">
            <div className="loading-spinner mx-auto mb-3" />
            <p className="text-white/20 text-xs">로딩 중...</p>
          </div>
        )}
        {!isLoading && upcoming.length === 0 && (
          <div className="py-20 text-center">
            <span className="material-icons text-white/10 text-5xl">calendar_today</span>
            <p className="text-xs text-white/20 mt-4">예정된 경기가 없습니다</p>
            {isAdmin && <p className="text-xs text-white/20 mt-1">오른쪽 상단 버튼으로 경기를 추가하세요</p>}
          </div>
        )}
        {upcoming.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            attendees={attendees[match.id] || []}
            mercenaries={matchMercenaries[match.id] || []}
            userId={user?.id}
            onOpen={() => handleOpenDetail(match)}
          />
        ))}
        {past.length > 0 && (
          <div className="mt-10">
            <button
              onClick={() => { setShowPast((v) => !v); setPastPage(1); }}
              className="flex items-center gap-2 text-white/30 text-xs font-black uppercase tracking-widest py-2"
            >
              <span className="material-icons text-sm">{showPast ? "expand_less" : "expand_more"}</span>
              지난 경기 {past.length}건
            </button>
            {showPast && (
              <div className="space-y-4 mt-3">
                {pagedPast.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    attendees={attendees[match.id] || []}
                    mercenaries={matchMercenaries[match.id] || []}
                    userId={user?.id}
                    isPast
                    onOpen={() => handleOpenDetail(match)}
                  />
                ))}
                {pastTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-1.5 pt-2">
                    {Array.from({ length: pastTotalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPastPage(p)}
                        className="w-8 h-8 rounded-full text-[11px] font-black transition-all"
                        style={p === pastPage
                          ? { backgroundColor: "#0DF23E", color: "#0a150d" }
                          : { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }
                        }
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {selectedMatch && (
        <MatchDetailSheet
          match={selectedMatch}
          attendees={attendees[selectedMatch.id] || []}
          comments={comments[selectedMatch.id] || []}
          mercenaries={matchMercenaries[selectedMatch.id] || []}
          matchDivisions={divisionHistory.filter((d) => d.matchId === selectedMatch.id)}
          userId={user?.id}
          squad={squad}
          isAdmin={isAdmin}
          onClose={handleCloseDetail}
          onRSVP={handleRSVP}
          onAddComment={handleAddComment}
          onUpdateComment={handleUpdateComment}
          onDeleteComment={(id) => deleteComment(id, selectedMatch.id)}
          onDeleteMatch={() => { deleteMatch(selectedMatch.id); handleCloseDetail(); }}
          onAddMercenary={(name) => addMatchMercenary(selectedMatch.id, name)}
          onRemoveMercenary={(id) => removeMatchMercenary(selectedMatch.id, id)}
          onGoToDivision={() => handleGoToDivision(selectedMatch)}
          onEditMatch={(data) => handleEditMatch(selectedMatch.id, data)}
        />
      )}

      {showCreateModal && (
        <MatchFormModal
          mode="create"
          squadId={squad?.id || ""}
          userId={user?.id || ""}
          isAdmin={isAdmin}
          onClose={() => setShowCreateModal(false)}
          onSubmit={createMatch}
        />
      )}
    </div>
  );
}
