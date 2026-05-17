import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useSquadStore } from "@/stores/squadStore";
import { useMatchStore } from "@/stores/matchStore";
import { useAuthStore } from "@/stores/authStore";
import { useDivisionStore } from "@/stores/divisionStore";
import { useAnnouncementStore } from "@/stores/announcementStore";
import { supabase } from "@/lib/supabase";
import type { IMatch, IMatchAttendee, IMatchComment, ISquad, IMember, IDivision } from "@/types";
import PlaceSearchInput from "@/components/PlaceSearchInput";

// ─── 공통 설정 ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  attending: { label: "참석", color: "#0DF23E", textColor: "#0a150d", dimBg: "rgba(13,242,62,0.10)" },
  absent:    { label: "불참", color: "#ef4444", textColor: "#ffffff",  dimBg: "rgba(239,68,68,0.10)" },
  pending:   { label: "보류", color: "#f59e0b", textColor: "#0a150d", dimBg: "rgba(245,158,11,0.10)" },
  waitlist:  { label: "대기", color: "#f97316", textColor: "#ffffff",  dimBg: "rgba(249,115,22,0.10)" },
} as const;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

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

  const now = new Date();
  const upcoming = matches.filter((m) => new Date(m.matchDate) >= now);
  const past = matches.filter((m) => new Date(m.matchDate) < now).reverse();
  const pastTotalPages = Math.ceil(past.length / PAST_PAGE_SIZE);
  const pagedPast = past.slice((pastPage - 1) * PAST_PAGE_SIZE, pastPage * PAST_PAGE_SIZE);
  const isAdmin = userRole === "owner" || userRole === "admin";

  useEffect(() => {
    if (!squad?.id) return;
    loadMatches(squad.id);
    loadAnnouncements(squad.id);
  }, [squad?.id]);

  useEffect(() => {
    matches.forEach((m) => { if (!attendees[m.id]) loadAttendees(m.id); });
  }, [matches.length]);

  useEffect(() => {
    if (!user || !squad?.id) return;
    supabase
      .from("squad_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("squad_id", squad.id)
      .single()
      .then(({ data }) => { if (data) setUserRole(data.role); });
  }, [user?.id, squad?.id]);

  const handleOpenDetail = (match: IMatch) => {
    setSelectedMatch(match);
    loadAttendees(match.id);
    loadComments(match.id);
    loadMercenaries(match.id);
  };

  const handleCloseDetail = () => setSelectedMatch(null);

  const handleRSVP = async (status: "attending" | "absent" | "waitlist") => {
    if (!user || !selectedMatch) return;
    const linkedMemberId = user.user_metadata?.member_id as string | undefined;
    await setAttendance(selectedMatch.id, user.id, status, linkedMemberId);
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
          {user && (
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
                  <span className="material-icons text-primary/60 text-base flex-shrink-0 mt-0.5">campaign</span>
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
                      <span className="ml-2 text-primary/50 font-black">· 고정</span>
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
        <CreateMatchModal
          squadId={squad?.id || ""}
          userId={user?.id || ""}
          onClose={() => setShowCreateModal(false)}
          onCreate={createMatch}
        />
      )}
    </div>
  );
}

// ─── MatchCard ────────────────────────────────────────────────────────────────

interface MatchCardProps {
  match: IMatch;
  attendees: IMatchAttendee[];
  userId?: string;
  isPast?: boolean;
  onOpen: () => void;
}

function getDDay(matchDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const match = new Date(matchDate);
  match.setHours(0, 0, 0, 0);
  const diff = Math.floor((match.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "D-Day";
  return `D-${diff}`;
}

function MatchCard({ match, attendees, userId, isPast, onOpen }: MatchCardProps) {
  const attending = attendees.filter((a) => a.status === "attending");
  const myStatus = attendees.find((a) => a.userId === userId)?.status ?? null;
  const isFull = !isPast && attending.length >= match.maxPlayers;
  const date = new Date(match.matchDate);
  const statusCfg = myStatus ? STATUS_CONFIG[myStatus] : null;
  const dday = !isPast ? getDDay(match.matchDate) : null;
  const isDDay = dday === "D-Day";

  return (
    <button
      onClick={onOpen}
      className={`w-full text-left rounded-2xl border transition-all active:scale-[0.98] ${isPast ? "opacity-50" : ""} ${myStatus === "attending" && !isPast ? "border-primary/20 bg-primary/5" : "border-white/5 bg-white/5"}`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center border ${myStatus === "attending" && !isPast ? "bg-primary/10 border-primary/30" : "bg-white/5 border-white/5"}`}>
            <span className={`text-[10px] font-black ${myStatus === "attending" && !isPast ? "text-primary" : "text-white/40"}`}>
              {date.toLocaleDateString("ko-KR", { month: "short" })}
            </span>
            <span className="text-xl font-black text-white leading-tight">{date.getDate()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-white font-black text-base tracking-wide truncate">{match.title}</p>
              {isFull ? (
                <span className="flex-shrink-0 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400/80">마감</span>
              ) : statusCfg ? (
                <span className="flex-shrink-0 text-[10px] font-black px-2.5 py-0.5 rounded-full" style={{ backgroundColor: statusCfg.dimBg, color: statusCfg.color }}>
                  {statusCfg.label}
                </span>
              ) : !isPast ? (
                <span className="flex-shrink-0 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-white/5 text-white/25">미응답</span>
              ) : null}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-white/40 text-xs">{date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
              {match.location && (
                <span className="flex items-center gap-1 text-white/30 text-xs">
                  <span className="material-icons text-[10px]">location_on</span>{match.location}
                </span>
              )}
              {dday && (
                <span
                  className={`ml-auto text-[10px] font-black px-2 py-0.5 rounded-full ${isDDay ? "animate-pulse" : ""}`}
                  style={{
                    backgroundColor: isDDay ? "rgba(13,242,62,0.15)" : "rgba(255,255,255,0.06)",
                    color: "#0DF23E",
                    boxShadow: isDDay ? "0 0 8px rgba(13,242,62,0.3)" : "none",
                  }}
                >
                  {dday}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs font-black ${myStatus === "attending" && !isPast ? "text-primary" : "text-white/40"}`}>
                {attending.length} / {match.maxPlayers}명
              </span>
              <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((attending.length / match.maxPlayers) * 100, 100)}%`, backgroundColor: myStatus === "attending" && !isPast ? "#0DF23E" : "rgba(255,255,255,0.15)" }} />
              </div>
              <span className="material-icons text-white/15 text-sm">chevron_right</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── CommentItem ──────────────────────────────────────────────────────────────

interface CommentItemProps {
  comment: IMatchComment;
  parentId?: string;
  isReply?: boolean;
  userId?: string;
  onReply: (parentId: string, mentionName: string) => void;
  onAction: (comment: IMatchComment, x?: number, y?: number) => void;
}

function CommentItem({ comment, parentId, isReply, userId, onReply, onAction }: CommentItemProps) {
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const isSwiping = useRef(false);
  const swipeFired = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isSwiping.current = false;
    swipeFired.current = false;

    if (comment.userId === userId) {
      longPressTimer.current = setTimeout(() => {
        if (!isSwiping.current) {
          if (navigator.vibrate) navigator.vibrate(50);
          onAction(comment);
        }
      }, 500);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (Math.abs(dy) > Math.abs(dx) + 5) { cancelLongPress(); return; }

    if (dx < -8) {
      isSwiping.current = true;
      cancelLongPress();
      setSwipeX(Math.max(dx, -75));
    }
  };

  const handleTouchEnd = () => {
    cancelLongPress();
    if (swipeX < -55 && !swipeFired.current) {
      swipeFired.current = true;
      if (navigator.vibrate) navigator.vibrate(30);
      onReply(parentId ?? comment.id, comment.username);
    }
    setSwipeX(0);
    isSwiping.current = false;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (comment.userId !== userId) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    onAction(comment, e.clientX, e.clientY);
  };

  const replyIconOpacity = Math.min(Math.abs(swipeX) / 55, 1);

  return (
    <div className={`relative overflow-hidden rounded-xl ${isReply ? "ml-10" : ""}`}>
      <div
        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center pointer-events-none"
        style={{ opacity: replyIconOpacity, background: "rgba(13,242,62,0.15)" }}
      >
        <span className="material-icons text-primary text-sm">reply</span>
      </div>

      <div
        className="flex gap-3 py-0.5 select-none"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swipeX === 0 ? "transform 0.22s ease-out" : "none",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black mt-0.5"
          style={{ background: "rgba(13,242,62,0.12)", color: "#0DF23E" }}
        >
          {comment.username.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black text-white/70">{comment.username}</span>
            <span className="text-[10px] text-white/20">{timeAgo(comment.createdAt)}</span>
            {comment.updatedAt && (
              <span className="text-[10px] text-white/15">(수정됨)</span>
            )}
          </div>
          <p className="text-sm text-white/55 mt-0.5 leading-relaxed break-words">{comment.content}</p>
        </div>
      </div>
    </div>
  );
}

// ─── MatchDetailSheet ─────────────────────────────────────────────────────────

interface MatchDetailSheetProps {
  match: IMatch;
  attendees: IMatchAttendee[];
  comments: IMatchComment[];
  mercenaries: IMember[];
  matchDivisions: IDivision[];
  userId?: string;
  squad: ISquad | null;
  isAdmin: boolean;
  onClose: () => void;
  onRSVP: (status: "attending" | "absent" | "waitlist") => Promise<void>;
  onAddComment: (content: string, parentId?: string) => Promise<void>;
  onUpdateComment: (commentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onDeleteMatch: () => void;
  onAddMercenary: (name: string) => Promise<void>;
  onRemoveMercenary: (id: string) => Promise<void>;
  onGoToDivision: () => void;
  onEditMatch: (data: Partial<Omit<IMatch, "id" | "createdAt" | "squadId">>) => Promise<void>;
}

interface ReplyTarget { parentId: string; mentionName: string; }
interface ContextMenuState { comment: IMatchComment; x: number; y: number; }

function MatchDetailSheet({
  match, attendees, comments, mercenaries, matchDivisions, userId, squad, isAdmin,
  onClose, onRSVP, onAddComment, onUpdateComment, onDeleteComment, onDeleteMatch,
  onAddMercenary, onRemoveMercenary, onGoToDivision, onEditMatch,
}: MatchDetailSheetProps) {
  const [visible, setVisible] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [showDeleteMatchConfirm, setShowDeleteMatchConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [matchMenuOpen, setMatchMenuOpen] = useState(false);
  const [mercenaryName, setMercenaryName] = useState("");
  const [locationCopied, setLocationCopied] = useState(false);
  const [expanded, setExpanded] = useState({
    notes: false,
    mercenary: false,
    divisions: false,
  });
  const toggleSection = (key: keyof typeof expanded) =>
    setExpanded((p) => ({ ...p, [key]: !p[key] }));
  const [attendeesSheetOpen, setAttendeesSheetOpen] = useState(false);

  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [editingComment, setEditingComment] = useState<IMatchComment | null>(null);
  const [actionSheet, setActionSheet] = useState<IMatchComment | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [contextMenu]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 320);
  };

  const cancelMode = () => {
    setReplyTo(null);
    setEditingComment(null);
    setCommentText("");
  };

  const handleActionRequest = (comment: IMatchComment, x?: number, y?: number) => {
    if (x !== undefined && y !== undefined) {
      const menuW = 148, menuH = 100;
      setContextMenu({
        comment,
        x: Math.min(x, window.innerWidth - menuW - 8),
        y: Math.min(y, window.innerHeight - menuH - 8),
      });
    } else {
      setActionSheet(comment);
    }
  };

  const startEdit = (comment: IMatchComment) => {
    setEditingComment(comment);
    setCommentText(comment.content);
    setReplyTo(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCommentSubmit = async () => {
    const text = commentText.trim();
    if (!text) return;
    setCommentLoading(true);
    try {
      if (editingComment) {
        await onUpdateComment(editingComment.id, text);
        setEditingComment(null);
      } else {
        await onAddComment(text, replyTo?.parentId);
        setReplyTo(null);
      }
      setCommentText("");
    } finally {
      setCommentLoading(false);
    }
  };

  const handleAddMercenarySubmit = () => {
    const name = mercenaryName.trim();
    if (!name) return;
    onAddMercenary(name);
    setMercenaryName("");
  };

  // 참석 현황
  const attending = attendees.filter((a) => a.status === "attending");
  const absent    = attendees.filter((a) => a.status === "absent");
  const pending   = attendees.filter((a) => a.status === "pending");
  const waitlist  = attendees.filter((a) => a.status === "waitlist");
  const myStatus  = attendees.find((a) => a.userId === userId)?.status ?? null;
  const isPast = new Date(match.matchDate) < new Date();
  const isOverCapacity = attending.length >= match.maxPlayers;
  // 신청 마감: 경기 시간 지남 OR 정원이 다 참

  const date = new Date(match.matchDate);
  const dateStr = date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
  const timeStr = date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  const getMemberName = (a: IMatchAttendee) => {
    if (a.memberId) {
      const m = squad?.members.find((m) => m.id === a.memberId);
      if (m) return m.name;
    }
    return a.username ?? "알 수 없음";
  };

  const handleRSVP = async (status: "attending" | "absent") => {
    if (myStatus === status) return;
    setRsvpLoading(true);
    try { await onRSVP(status); } finally { setRsvpLoading(false); }
  };

  const totalComments = comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9999]"
        style={{
          backgroundColor: visible ? "rgba(0,0,0,0.65)" : "transparent",
          transition: "background-color 0.32s",
          pointerEvents: visible ? "auto" : "none",
        }}
        onClick={handleClose}
      >
        {/* Layout과 동일한 max-w-md 컨테이너 */}
        <div className="max-w-md mx-auto h-full relative">
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              inset: 0,
              background: "#0a150d",
              transform: visible ? "translateY(0)" : "translateY(100%)",
              transition: "transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}
          >
          {/* 드래그 핸들 */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* 액션바 — 좌(닫기) / 우(케밥) 대칭 분리 */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 pt-1 pb-1">
            <button
              onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white transition-colors active:scale-90"
            >
              <span className="material-icons text-lg">close</span>
            </button>

            {(isAdmin || match.createdBy === userId) ? (
              <div className="relative">
                <button
                  onClick={() => setMatchMenuOpen(v => !v)}
                  className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white transition-colors active:scale-90"
                >
                  <span className="material-icons text-lg">more_vert</span>
                </button>
                {matchMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMatchMenuOpen(false)} />
                    <div
                      className="absolute right-0 top-10 z-20 rounded-lg overflow-hidden whitespace-nowrap shadow-lg"
                      style={{ background: "rgba(28,34,28,0.98)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <button
                        onClick={() => { setShowEditModal(true); setMatchMenuOpen(false); }}
                        className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/5 transition-colors"
                      >
                        <span className="material-icons" style={{ fontSize: "14px" }}>edit</span>
                        수정
                      </button>
                      <button
                        onClick={() => { setShowDeleteMatchConfirm(true); setMatchMenuOpen(false); }}
                        className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/5"
                      >
                        <span className="material-icons" style={{ fontSize: "14px" }}>delete</span>
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="w-9 h-9" />
            )}
          </div>

          {/* 제목 영역 — 별도 섹션으로 격상 */}
          <div className="flex-shrink-0 px-5 pb-5 border-b border-white/5">
            <h2 className="text-2xl font-black text-white tracking-tight leading-tight">{match.title}</h2>
            <p className="text-xs text-white/40 mt-1.5 font-bold">{dateStr} · {timeStr}</p>
          </div>

          {/* 스크롤 본문 */}
          <div className="flex-1 overflow-y-auto hide-scrollbar">

            {/* 장소 — 항상 표시 */}
            {match.location && (
              <div className="px-5 py-5 border-b border-white/5">
                <div className="flex items-start gap-2 text-sm text-white/70 mb-2">
                  <span className="material-icons text-base text-white/40 mt-0.5">location_on</span>
                  <span className="flex-1 leading-relaxed break-all">{match.location}</span>
                </div>
                <div className="flex gap-1.5 pl-7 flex-wrap">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(match.location!);
                        setLocationCopied(true);
                        setTimeout(() => setLocationCopied(false), 1500);
                      } catch {/* ignore */}
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70 transition-all active:scale-95"
                  >
                    <span className="material-icons" style={{ fontSize: 12 }}>
                      {locationCopied ? "check" : "content_copy"}
                    </span>
                    {locationCopied ? "복사됨" : "주소 복사"}
                  </button>
                  <a
                    href={`https://map.kakao.com/?q=${encodeURIComponent(match.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all active:scale-95"
                    style={{ background: "rgba(250,204,21,0.10)", borderColor: "rgba(250,204,21,0.25)", color: "rgba(254,240,138,0.95)" }}
                  >
                    <span className="material-icons" style={{ fontSize: 12 }}>map</span>
                    카카오맵
                  </a>
                  <a
                    href={`https://map.naver.com/v5/search/${encodeURIComponent(match.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all active:scale-95"
                    style={{ background: "rgba(34,197,94,0.10)", borderColor: "rgba(34,197,94,0.25)", color: "rgba(134,239,172,0.95)" }}
                  >
                    <span className="material-icons" style={{ fontSize: 12 }}>map</span>
                    네이버지도
                  </a>
                </div>
              </div>
            )}

            {/* 메모 — 접기/펼치기 */}
            {match.notes && (
              <div className="border-b border-white/5">
                <button
                  onClick={() => toggleSection("notes")}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
                >
                  <span className="flex items-center gap-3 text-sm font-bold text-white/80">
                    <span className="material-icons text-base text-white/50">notes</span>
                    메모
                  </span>
                  <span
                    className="material-icons text-base text-white/30 transition-transform"
                    style={{ transform: expanded.notes ? "rotate(90deg)" : "rotate(0deg)" }}
                  >
                    chevron_right
                  </span>
                </button>
                {expanded.notes && (
                  <div className="px-5 pb-5">
                    <p className="text-sm text-white/60 leading-relaxed pl-7">{match.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* 참석 현황 카드 — 카카오톡 투표 스타일 */}
            <div className="px-5 py-6 border-b border-white/5">
              {/* 큰 숫자 + 정원 */}
              <div className="flex items-baseline justify-between mb-4">
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-black ${isOverCapacity ? "text-orange-400" : "text-primary"}`}>
                    {attending.length}
                  </span>
                  <span className="text-sm font-bold text-white/40">/ {match.maxPlayers}명</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/30">참석 현황</span>
              </div>

              {/* 프로그레스바 */}
              <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min((attending.length / match.maxPlayers) * 100, 100)}%`,
                    backgroundColor: isOverCapacity ? "#f97316" : "#0DF23E",
                  }}
                />
              </div>

              {/* 아바타 스택 + 전체 보기 */}
              {attending.length > 0 || absent.length > 0 || waitlist.length > 0 || pending.length > 0 ? (
                <button
                  onClick={() => setAttendeesSheetOpen(true)}
                  className="w-full flex items-center gap-3 -mx-1 px-1 py-1 rounded-xl hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex -space-x-2">
                    {attending.slice(0, 5).map((a) => (
                      <div
                        key={a.id}
                        className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-[11px] font-black"
                        style={{ background: "rgba(13,242,62,0.25)", color: "#0DF23E", borderColor: "#0a150d" }}
                      >
                        {getMemberName(a).slice(0, 1)}
                      </div>
                    ))}
                    {attending.length > 5 && (
                      <div
                        className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-[10px] font-black bg-white/10 text-white/60"
                        style={{ borderColor: "#0a150d" }}
                      >
                        +{attending.length - 5}
                      </div>
                    )}
                    {attending.length === 0 && (
                      <div
                        className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-white/20"
                        style={{ background: "rgba(255,255,255,0.03)", borderColor: "#0a150d" }}
                      >
                        <span className="material-icons text-sm">person</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-xs font-bold text-white/70">
                      {attending.length > 0 ? "참석자 보기" : "아직 참석자가 없습니다"}
                    </p>
                    {(waitlist.length > 0 || absent.length > 0) && (
                      <p className="text-[10px] text-white/40 mt-0.5">
                        {waitlist.length > 0 && <span className="text-orange-400/70">대기 {waitlist.length}</span>}
                        {waitlist.length > 0 && absent.length > 0 && <span className="mx-1">·</span>}
                        {absent.length > 0 && <span>불참 {absent.length}</span>}
                      </p>
                    )}
                  </div>
                  <span className="material-icons text-white/30 text-base">chevron_right</span>
                </button>
              ) : null}

              {isOverCapacity && !isPast && (
                <p className="mt-3 text-xs text-red-400/70 flex items-center gap-1">
                  <span className="material-icons text-sm">lock</span>정원 마감
                </p>
              )}
            </div>

            {/* 참석 여부 */}
            {isPast ? null : (
              <div className="px-5 py-5 border-b border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30">참석 여부</p>
                  {isOverCapacity && myStatus !== "attending" && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-400/70 border border-red-500/20">정원 마감</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(isOverCapacity && myStatus !== "attending"
                    ? (["waitlist", "absent"] as const)
                    : (["attending", "absent"] as const)
                  ).map((status) => {
                    const cfg = STATUS_CONFIG[status];
                    const isSelected = myStatus === status;
                    return (
                      <button
                        key={status}
                        onClick={() => handleRSVP(status)}
                        disabled={rsvpLoading}
                        className="py-3.5 rounded-xl text-xs font-black tracking-widest transition-all active:scale-95 disabled:opacity-40 border"
                        style={{ backgroundColor: isSelected ? cfg.color : "transparent", color: isSelected ? cfg.textColor : "rgba(255,255,255,0.35)", borderColor: isSelected ? cfg.color : "rgba(255,255,255,0.08)" }}
                      >
                        {rsvpLoading && isSelected
                          ? <span className="material-icons text-sm animate-spin">refresh</span>
                          : status === "waitlist" ? (isSelected ? "대기 중" : "대기 신청") : cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}


            {/* 용병 추가 — 접기/펼치기 */}
            <div className="border-b border-white/5">
              <button
                onClick={() => toggleSection("mercenary")}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <span className="flex items-center gap-3 text-sm font-bold text-white/80">
                  <span className="material-icons text-base" style={{ color: "#0DF23E" }}>person_add</span>
                  용병 추가
                  {mercenaries.length > 0 && (
                    <span className="text-xs font-bold text-primary/70">{mercenaries.length}</span>
                  )}
                </span>
                <span
                  className="material-icons text-base text-white/30 transition-transform"
                  style={{ transform: expanded.mercenary ? "rotate(90deg)" : "rotate(0deg)" }}
                >
                  chevron_right
                </span>
              </button>
              {expanded.mercenary && (
                <div className="px-5 pb-5">
              <div className="flex gap-2 mb-3">
                <input
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-all"
                  placeholder="용병 이름 입력"
                  value={mercenaryName}
                  onChange={(e) => setMercenaryName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddMercenarySubmit(); } }}
                />
                <button
                  onClick={handleAddMercenarySubmit}
                  disabled={!mercenaryName.trim()}
                  className="px-4 py-3 rounded-xl font-black text-sm active:scale-95 transition-all disabled:opacity-30"
                  style={{ backgroundColor: "#0DF23E", color: "#0a150d" }}
                >
                  추가
                </button>
              </div>
              {mercenaries.length > 0 && (
                <div className="space-y-2">
                  {mercenaries.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border-2"
                      style={{ background: "rgba(0,0,0,0.2)", borderColor: "rgba(255,255,255,0.06)" }}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: "rgba(249,115,22,0.15)" }}>
                          <span className="text-sm font-bold text-orange-400">{m.name.slice(0, 1)}</span>
                        </div>
                        <span className="text-sm font-bold text-white">{m.name}</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-orange-500/20 text-orange-400">용병</span>
                      </div>
                      <button
                        onClick={() => onRemoveMercenary(m.id)}
                        className="text-xs font-black px-3 py-1.5 rounded-xl border border-red-500/20 text-red-400 bg-red-500/10 active:scale-95 transition-all"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
                </div>
              )}
            </div>

            {/* 팀 나누기 버튼 */}
            {!isPast && (
              <div className="px-5 py-5 border-b border-white/5">
                <button
                  onClick={onGoToDivision}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 border border-primary/25"
                  style={{ background: "rgba(13,242,62,0.08)", color: "#0DF23E" }}
                >
                  <span className="material-icons text-sm">sports_soccer</span>
                  팀 나누기
                  <span className="material-icons text-sm">arrow_forward</span>
                </button>
              </div>
            )}

            {/* 팀 배정 결과 — 접기/펼치기 */}
            {matchDivisions.length > 0 && (
              <div className="border-b border-white/5">
                <button
                  onClick={() => toggleSection("divisions")}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
                >
                  <span className="flex items-center gap-3 text-sm font-bold text-white/80">
                    <span className="material-icons text-base text-primary">groups</span>
                    팀 배정 결과
                    <span className="text-xs font-bold text-primary/70">{matchDivisions.length}</span>
                  </span>
                  <span
                    className="material-icons text-base text-white/30 transition-transform"
                    style={{ transform: expanded.divisions ? "rotate(90deg)" : "rotate(0deg)" }}
                  >
                    chevron_right
                  </span>
                </button>
                {expanded.divisions && (
                  <div className="px-5 pb-5 space-y-4">
                  {matchDivisions.map((div) => {
                    const TEAM_COLORS = [
                      { bg: "rgba(13,242,62,0.10)",  text: "#0DF23E" },
                      { bg: "rgba(59,130,246,0.12)", text: "#60a5fa" },
                      { bg: "rgba(249,115,22,0.12)", text: "#fb923c" },
                      { bg: "rgba(168,85,247,0.12)", text: "#c084fc" },
                    ];
                    return (
                      <div key={div.id}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-2">
                          {div.period}
                        </p>
                        <div className="space-y-2">
                          {div.teams.map((team, ti) => {
                            const col = TEAM_COLORS[ti % TEAM_COLORS.length];
                            return (
                              <div key={ti} className="rounded-xl p-3" style={{ background: col.bg }}>
                                <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: col.text }}>
                                  팀 {ti + 1} · {team.length}명
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {team.map((m) => (
                                    <span
                                      key={m.id}
                                      className="text-xs px-2 py-0.5 rounded-full font-bold"
                                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}
                                    >
                                      {m.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>
            )}


            {/* 댓글 섹션 */}
            <div>
              <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                <span className="material-icons text-base text-primary">forum</span>
                <span className="text-sm font-bold text-white/80">댓글</span>
                {totalComments > 0 && <span className="text-xs font-bold text-white/40">{totalComments}</span>}
              </div>
              <div className="px-5 pb-5">
                {totalComments === 0 ? (
                  <p className="text-xs text-white/20 text-center py-6">첫 번째 댓글을 남겨보세요</p>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="space-y-3">
                        <CommentItem
                          comment={comment}
                          userId={userId}
                          onReply={(pid, name) => { setReplyTo({ parentId: pid, mentionName: name }); setTimeout(() => inputRef.current?.focus(), 50); }}
                          onAction={handleActionRequest}
                        />
                        {(comment.replies || []).map((reply) => (
                          <CommentItem
                            key={reply.id}
                            comment={reply}
                            parentId={comment.id}
                            isReply
                            userId={userId}
                            onReply={(pid, name) => { setReplyTo({ parentId: pid, mentionName: name }); setTimeout(() => inputRef.current?.focus(), 50); }}
                            onAction={handleActionRequest}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                <div className="h-2" />
              </div>
            </div>
          </div>

          {/* 댓글 입력바 */}
          <div className="flex-shrink-0 border-t border-white/5" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
            {(replyTo || editingComment) && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5" style={{ background: "rgba(13,242,62,0.04)" }}>
                <div className="flex items-center gap-2">
                  <span className="material-icons text-sm text-primary/50">{replyTo ? "reply" : "edit"}</span>
                  <span className="text-xs text-white/40 font-bold">
                    {replyTo ? `${replyTo.mentionName}에게 답글` : "댓글 수정 중"}
                  </span>
                </div>
                <button onClick={cancelMode} className="text-white/25 hover:text-white/50">
                  <span className="material-icons text-base">close</span>
                </button>
              </div>
            )}
            <div className="flex gap-2 items-center px-4 pt-3">
              <input
                ref={inputRef}
                className="flex-1 bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-white/20 transition-colors"
                placeholder={replyTo ? `${replyTo.mentionName}에게 답글...` : editingComment ? "댓글 수정..." : "댓글 달기..."}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCommentSubmit(); } }}
              />
              <button
                onClick={handleCommentSubmit}
                disabled={!commentText.trim() || commentLoading}
                className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-30 transition-all active:scale-95 flex-shrink-0"
                style={{ backgroundColor: "#0DF23E", color: "#0a150d" }}
              >
                {commentLoading
                  ? <span className="material-icons text-sm animate-spin">refresh</span>
                  : <span className="material-icons text-sm">{editingComment ? "check" : "send"}</span>}
              </button>
            </div>
          </div>

          {/* 모바일 액션 시트 */}
          {actionSheet && (
            <div className="absolute inset-0 z-20 flex items-end" style={{ background: "rgba(0,0,0,0.65)" }} onClick={() => setActionSheet(null)}>
              <div className="w-full rounded-t-2xl overflow-hidden" style={{ background: "#16261b" }} onClick={(e) => e.stopPropagation()}>
                <div className="px-5 pt-5 pb-4 border-b border-white/5">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">{actionSheet.username}</p>
                  <p className="text-sm text-white/60 line-clamp-2">{actionSheet.content}</p>
                </div>
                <button
                  onClick={() => { startEdit(actionSheet); setActionSheet(null); }}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/5 transition-colors"
                >
                  <span className="material-icons text-white/50">edit</span>
                  <span className="text-sm font-bold text-white/70">수정</span>
                </button>
                <button
                  onClick={() => { onDeleteComment(actionSheet.id); setActionSheet(null); }}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-red-500/10 transition-colors"
                >
                  <span className="material-icons text-red-400">delete</span>
                  <span className="text-sm font-bold text-red-400">삭제</span>
                </button>
                <div className="h-px bg-white/5" />
                <button
                  onClick={() => setActionSheet(null)}
                  className="w-full py-4 text-center text-sm font-bold text-white/30"
                  style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 경기 삭제 확인 */}
          {showDeleteMatchConfirm && (
            <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: "rgba(0,0,0,0.75)" }}>
              <div className="mx-5 w-full max-w-xs rounded-2xl p-6" style={{ background: "#16261b", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-white font-black mb-1">경기를 삭제할까요?</p>
                <p className="text-white/40 text-sm mb-5 leading-relaxed">{match.title} · 참석 신청 기록과 댓글이 모두 삭제됩니다.</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowDeleteMatchConfirm(false)} className="flex-1 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white/40 text-xs font-black uppercase tracking-widest active:scale-95 transition-all">취소</button>
                  <button onClick={onDeleteMatch} className="flex-1 py-3.5 rounded-xl text-white text-xs font-black uppercase tracking-widest active:scale-95 transition-all" style={{ backgroundColor: "rgba(239,68,68,0.7)" }}>삭제</button>
                </div>
              </div>
            </div>
          )}
          </div>{/* end sheet */}
        </div>{/* end max-w-md */}
      </div>{/* end backdrop */}

      {/* 경기 수정 모달 */}
      {showEditModal && (
        <EditMatchModal
          match={match}
          onClose={() => setShowEditModal(false)}
          onSave={async (data) => { await onEditMatch(data); setShowEditModal(false); }}
        />
      )}

      {/* 참석자 전체 명단 시트 */}
      {attendeesSheetOpen && createPortal(
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center px-6 z-[100000] animate-fade-in"
          onClick={() => setAttendeesSheetOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: "rgba(22,28,22,0.98)", border: "1px solid rgba(13,242,62,0.15)", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
              <h3 className="text-base font-black text-white">참석 명단</h3>
              <button onClick={() => setAttendeesSheetOpen(false)} className="w-9 h-9 flex items-center justify-center text-white/40 hover:text-white transition-colors active:scale-90">
                <span className="material-icons text-lg">close</span>
              </button>
            </div>
            <div className="overflow-y-auto hide-scrollbar p-5 space-y-5">
              {attending.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary/60 mb-3">참석 ({attending.length})</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {attending.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border"
                        style={{ background: "rgba(13,242,62,0.07)", borderColor: "rgba(13,242,62,0.25)" }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-black"
                          style={{ background: "rgba(13,242,62,0.25)", color: "#0DF23E" }}>
                          {getMemberName(a).slice(0, 1)}
                        </div>
                        <span className="text-xs font-bold text-white truncate">{getMemberName(a)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {waitlist.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-orange-400/60 mb-3">대기 ({waitlist.length})</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {waitlist.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border"
                        style={{ background: "rgba(249,115,22,0.06)", borderColor: "rgba(249,115,22,0.2)" }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-black"
                          style={{ background: "rgba(249,115,22,0.2)", color: "#fb923c" }}>
                          {getMemberName(a).slice(0, 1)}
                        </div>
                        <span className="text-xs font-bold text-white/60 truncate">{getMemberName(a)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {absent.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/20 mb-3">불참 ({absent.length})</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {absent.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border opacity-40"
                        style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-black bg-white/10 text-white/40">
                          {getMemberName(a).slice(0, 1)}
                        </div>
                        <span className="text-xs font-bold text-white/40 truncate">{getMemberName(a)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {attending.length === 0 && waitlist.length === 0 && absent.length === 0 && (
                <p className="text-center text-white/30 text-sm py-10">아직 응답이 없습니다</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PC 우클릭 컨텍스트 메뉴 */}
      {contextMenu && createPortal(
        <div className="fixed inset-0 z-[99999]" onClick={() => setContextMenu(null)} onContextMenu={(e) => e.preventDefault()}>
          <div
            className="absolute rounded-xl overflow-hidden shadow-2xl"
            style={{ left: contextMenu.x, top: contextMenu.y, minWidth: 148, background: "#16261b", border: "1px solid rgba(255,255,255,0.08)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { startEdit(contextMenu.comment); setContextMenu(null); }}
              className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <span className="material-icons text-sm text-white/50">edit</span>
              <span className="text-sm font-bold text-white/70">수정</span>
            </button>
            <div className="h-px bg-white/5" />
            <button
              onClick={() => { onDeleteComment(contextMenu.comment.id); setContextMenu(null); }}
              className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-red-500/10 transition-colors"
            >
              <span className="material-icons text-sm text-red-400">delete</span>
              <span className="text-sm font-bold text-red-400">삭제</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </>,
    document.body
  );
}

// ─── CreateMatchModal ─────────────────────────────────────────────────────────

interface CreateMatchModalProps {
  squadId: string;
  userId: string;
  onClose: () => void;
  onCreate: (squadId: string, data: Omit<IMatch, "id" | "createdAt" | "squadId">) => Promise<void>;
}

function CreateMatchModal({ squadId, userId, onClose, onCreate }: CreateMatchModalProps) {
  const [title, setTitle] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [location, setLocation] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(15);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const autoTitle = matchDate
    ? new Date(matchDate).toLocaleString("ko-KR", {
        month: "numeric", day: "numeric", weekday: "short",
        hour: "2-digit", minute: "2-digit",
      }) + " 경기"
    : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    const finalTitle = title.trim() || autoTitle;
    try {
      await onCreate(squadId, {
        title: finalTitle,
        matchDate: new Date(matchDate).toISOString(),
        location: location || undefined,
        maxPlayers,
        notes: notes || undefined,
        createdBy: userId,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "경기 생성 실패");
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center px-6 z-[9999] animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-6 overflow-y-auto" style={{ background: "rgba(22,28,22,0.98)", border: "1px solid rgba(13,242,62,0.15)", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white mb-1">경기 추가</h2>
        <div className="h-0.5 w-6 bg-primary rounded-full shadow-[0_0_8px_#0df23e] mb-6" />
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">경기 제목 <span className="normal-case font-normal text-white/25">(선택)</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={autoTitle || "예: 5월 3주차 경기"} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-all" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">날짜 / 시간</label>
            <input type="datetime-local" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all [color-scheme:dark]" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">장소 (선택)</label>
            <PlaceSearchInput value={location} onChange={setLocation} />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">최대 인원</label>
            <input type="number" value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))} min={2} max={50} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all text-center font-bold" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">메모 (선택)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="공지사항, 준비물 등" rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-all resize-none" />
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs font-medium">{error}</div>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest bg-white/5 border border-white/10 text-white/40 transition-all active:scale-95">취소</button>
            <button type="submit" disabled={isLoading || !matchDate} className="flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40" style={{ backgroundColor: "#0DF23E", color: "#0a150d" }}>
              {isLoading ? "생성 중..." : "경기 추가"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── EditMatchModal ───────────────────────────────────────────────────────────

interface EditMatchModalProps {
  match: IMatch;
  onClose: () => void;
  onSave: (data: Partial<Omit<IMatch, "id" | "createdAt" | "squadId">>) => Promise<void>;
}

function EditMatchModal({ match, onClose, onSave }: EditMatchModalProps) {
  const toLocalDatetime = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [title, setTitle] = useState(match.title);
  const [matchDate, setMatchDate] = useState(toLocalDatetime(match.matchDate));
  const [location, setLocation] = useState(match.location ?? "");
  const [maxPlayers, setMaxPlayers] = useState(match.maxPlayers);
  const [notes, setNotes] = useState(match.notes ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await onSave({
        title,
        matchDate: new Date(matchDate).toISOString(),
        location: location || undefined,
        maxPlayers,
        notes: notes || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "수정 실패");
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center px-6 z-[9999] animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-6 overflow-y-auto" style={{ background: "rgba(22,28,22,0.98)", border: "1px solid rgba(13,242,62,0.15)", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white mb-1">경기 수정</h2>
        <div className="h-0.5 w-6 bg-primary rounded-full shadow-[0_0_8px_#0df23e] mb-6" />
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">경기 제목</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">날짜 / 시간</label>
            <input type="datetime-local" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all [color-scheme:dark]" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">장소 (선택)</label>
            <PlaceSearchInput value={location} onChange={setLocation} />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">최대 인원</label>
            <input type="number" value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))} min={2} max={50} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all text-center font-bold" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">메모 (선택)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-all resize-none" />
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs">{error}</div>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest bg-white/5 border border-white/10 text-white/40 transition-all active:scale-95">취소</button>
            <button type="submit" disabled={isLoading || !title || !matchDate} className="flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40" style={{ backgroundColor: "#0DF23E", color: "#0a150d" }}>
              {isLoading ? "저장 중..." : "수정 완료"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
