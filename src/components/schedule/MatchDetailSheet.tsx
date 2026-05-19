import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { IMatch, IMatchAttendee, IMatchComment, ISquad, IMember, IDivision } from "@/types";
import { shareMatch, isKakaoReady } from "@/lib/kakaoShare";
import { KakaoIcon } from "@/components/icons/KakaoIcon";
import { ShareMenu } from "@/components/ShareMenu";
import { toast } from "@/stores/toastStore";
import { toFriendlyMessage } from "@/lib/errorMessage";
import { CommentItem } from "./CommentItem";
import { MatchFormModal } from "./MatchFormModal";

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

const TEAM_COLORS = [
  { bg: "rgba(13,242,62,0.10)",  text: "#0DF23E" },
  { bg: "rgba(59,130,246,0.12)", text: "#60a5fa" },
  { bg: "rgba(249,115,22,0.12)", text: "#fb923c" },
  { bg: "rgba(168,85,247,0.12)", text: "#c084fc" },
];

export function MatchDetailSheet({
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
  const [attendeesFilter, setAttendeesFilter] = useState<"attending" | "absent" | "waitlist" | null>(null);
  const [mercenaryDialogOpen, setMercenaryDialogOpen] = useState(false);

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

  const handleAddMercenarySubmit = async () => {
    const name = mercenaryName.trim();
    if (!name) return;
    try {
      await onAddMercenary(name);
      setMercenaryName("");
    } catch (e) {
      toast(toFriendlyMessage(e, "용병 추가에 실패했습니다"), "error");
    }
  };

  // 참석 현황
  const attending = attendees.filter((a) => a.status === "attending");
  const absent    = attendees.filter((a) => a.status === "absent");
  const waitlist  = attendees.filter((a) => a.status === "waitlist");
  const myStatus  = attendees.find((a) => a.userId === userId)?.status ?? null;
  const isPast = new Date(match.matchDate) < new Date();
  const totalAttending = attending.length + mercenaries.length;
  const isOverCapacity = totalAttending >= match.maxPlayers;

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

  const handleRSVP = async (status: "attending" | "absent" | "waitlist") => {
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
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          <div className="flex-shrink-0 flex items-center justify-between px-3 pt-1 pb-1">
            <button
              onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white transition-colors active:scale-90"
            >
              <span className="material-icons text-lg">close</span>
            </button>

            <div className="flex items-center gap-1">
              <ShareMenu
                title="경기 공유"
                items={[
                  {
                    label: "링크 복사",
                    icon: <span className="material-icons text-base text-white/60">link</span>,
                    onClick: () => {
                      navigator.clipboard.writeText(window.location.href);
                      toast("링크가 복사되었습니다");
                    },
                  },
                  ...(isKakaoReady() ? [{
                    label: "카카오톡으로 보내기",
                    icon: <KakaoIcon size={20} />,
                    onClick: () => shareMatch({
                      title: match.title?.trim() || `${dateStr} 경기`,
                      matchDate: match.matchDate,
                      location: match.location,
                      attendingCount: totalAttending,
                      maxPlayers: match.maxPlayers,
                    }),
                  }] : []),
                ]}
                trigger={(open) => (
                  <button
                    onClick={open}
                    className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white transition-colors active:scale-90"
                  >
                    <span className="material-icons text-lg">ios_share</span>
                  </button>
                )}
              />
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
              ) : null}
            </div>
          </div>

          {/* 헤더 */}
          <div className="flex-shrink-0 px-5 pb-5 border-b border-white/5">
            <h2 className="text-2xl font-black text-white tracking-tight leading-tight">{dateStr}</h2>
            <p className="text-xs text-white/40 mt-1.5 font-bold">{timeStr}</p>
          </div>

          {/* 스크롤 본문 */}
          <div className="flex-1 overflow-y-auto hide-scrollbar">

            {/* === POLL CARD === */}
            <div className="m-5 rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {match.location && (
                <>
                  <div className="px-5 pt-5 pb-4">
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
                  <div className="h-px bg-white/5" />
                </>
              )}

              <div className="px-5 py-4 space-y-1">
                {/* 투표 옵션 — 라디오 클릭 한 번으로 즉시 적용 */}
                {(() => {
                  const showWaitlist = !isPast && (isOverCapacity || waitlist.length > 0) && myStatus !== "attending";
                  const opts = [
                    { key: "attending" as const, label: "참석", count: totalAttending, radioColor: "#0DF23E", checkColor: "#0a150d", barColor: "#0DF23E" },
                    { key: "absent"    as const, label: "불참", count: absent.length,  radioColor: "rgba(255,255,255,0.75)", checkColor: "#111",    barColor: "rgba(255,255,255,0.5)" },
                    ...(showWaitlist ? [{ key: "waitlist" as const, label: "대기", count: waitlist.length, radioColor: "#fb923c", checkColor: "#0a150d", barColor: "#fb923c" }] : []),
                  ];
                  return opts.map((opt) => {
                    const isSelected = myStatus === opt.key;
                    const percent = Math.min((opt.count / (match.maxPlayers || 1)) * 100, 100);
                    const disabled = isPast || rsvpLoading || (opt.key === "attending" && isOverCapacity && !isSelected);
                    return (
                      <button
                        key={opt.key}
                        onClick={() => !disabled && handleRSVP(opt.key)}
                        disabled={disabled}
                        className="w-full text-left py-2.5 transition-all active:opacity-60 disabled:opacity-30 disabled:cursor-default"
                      >
                        <div className="flex items-center gap-2.5 mb-2">
                          {/* 라디오 원형 — 작게 */}
                          <div
                            className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200"
                            style={isSelected
                              ? { backgroundColor: opt.radioColor, borderColor: opt.radioColor }
                              : { borderColor: "rgba(255,255,255,0.22)", backgroundColor: "transparent" }
                            }
                          >
                            {isSelected && (
                              <span className="material-icons" style={{ fontSize: 12, color: opt.checkColor, lineHeight: 1 }}>check</span>
                            )}
                          </div>
                          <span className={`text-sm font-bold flex-1 ${isSelected ? "text-white" : "text-white/45"}`}>
                            {opt.label}
                          </span>
                          <span className={`text-sm font-black tabular-nums ${isSelected ? "text-white" : "text-white/35"}`}>
                            {opt.count}
                          </span>
                        </div>
                        {/* 통계 바 — 행 전체 너비 */}
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${percent}%`, background: opt.barColor, opacity: isSelected ? 0.9 : 0.32 }}
                          />
                        </div>
                      </button>
                    );
                  });
                })()}

                {!isPast && isOverCapacity && myStatus !== "attending" && (
                  <p className="text-[11px] text-white/25 flex items-center justify-center gap-1 pt-2">
                    <span className="material-icons" style={{ fontSize: 13 }}>lock</span>
                    정원 마감 — 대기 신청만 가능합니다
                  </p>
                )}
              </div>

              <div className="h-px bg-white/5" />

              <button
                onClick={() => setAttendeesFilter("attending")}
                className="w-full px-5 py-3.5 flex items-center justify-end gap-1 text-xs font-bold text-white/40 hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors"
              >
                {attending.length + absent.length + waitlist.length}명 응답
                <span className="material-icons text-base">chevron_right</span>
              </button>
            </div>

            {/* 액션 칩 */}
            <div className="px-5 pb-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => setMercenaryDialogOpen(true)}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-bold text-white/80 active:scale-95 transition-all"
              >
                <span className="material-icons" style={{ color: "#0DF23E", fontSize: 18 }}>person_add</span>
                용병 추가
                {mercenaries.length > 0 && <span className="text-primary font-black">{mercenaries.length}</span>}
              </button>
              <button
                onClick={onGoToDivision}
                disabled={isPast}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-primary/30 text-xs font-black text-primary active:scale-95 transition-all disabled:opacity-40"
                style={{ background: "rgba(13,242,62,0.08)" }}
              >
                <span className="material-icons" style={{ fontSize: 18 }}>sports_soccer</span>
                팀 나누기
              </button>
            </div>

            {/* 메모 */}
            {match.notes && (
              <div className="px-5 pb-5">
                <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-icons text-white/40" style={{ fontSize: 14 }}>notes</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">메모</span>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{match.notes}</p>
                </div>
              </div>
            )}

            {/* 팀 배정 결과 */}
            {matchDivisions.length > 0 && (
              <div className="px-5 pb-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-icons text-primary" style={{ fontSize: 14 }}>groups</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">팀 배정 결과</span>
                  <span className="text-[10px] font-black text-primary/70">{matchDivisions.length}</span>
                </div>
                <div className="space-y-4">
                  {matchDivisions.map((div) => (
                    <div key={div.id}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-2">{div.period}</p>
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
                                  <span key={m.id} className="text-xs px-2 py-0.5 rounded-full font-bold"
                                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}>
                                    {m.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 댓글 */}
            <div className="border-t border-white/5">
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
                <p className="text-white/40 text-sm mb-5 leading-relaxed">{dateStr} 경기의 참석 신청 기록과 댓글이 모두 삭제됩니다.</p>
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
        <MatchFormModal
          mode="edit"
          match={match}
          onClose={() => setShowEditModal(false)}
          onSubmit={async (data) => { await onEditMatch(data); setShowEditModal(false); }}
        />
      )}

      {/* 용병 추가 모달 */}
      {mercenaryDialogOpen && createPortal(
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center px-6 z-[100000]"
          onClick={() => setMercenaryDialogOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: "rgba(22,28,22,0.98)", border: "1px solid rgba(13,242,62,0.12)", maxHeight: "75vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-icons text-base" style={{ color: "#0DF23E" }}>person_add</span>
                <span className="text-sm font-black text-white">용병 추가</span>
                {mercenaries.length > 0 && <span className="text-xs font-black text-primary/70">{mercenaries.length}</span>}
              </div>
              <button onClick={() => setMercenaryDialogOpen(false)} className="w-9 h-9 flex items-center justify-center text-white/40 hover:text-white transition-colors active:scale-90">
                <span className="material-icons text-lg">close</span>
              </button>
            </div>
            <div className="overflow-y-auto hide-scrollbar p-4 space-y-3">
              <div className="flex gap-2">
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
              {mercenaries.length === 0 ? (
                <p className="text-xs text-white/20 text-center py-6">아직 등록된 용병이 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {mercenaries.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border"
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
          </div>
        </div>,
        document.body
      )}

      {/* 참석자 명단 모달 */}
      {attendeesFilter && createPortal(
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center px-6 z-[100000]"
          onClick={() => setAttendeesFilter(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: "rgba(22,28,22,0.98)", border: "1px solid rgba(13,242,62,0.12)", maxHeight: "75vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-2">
                {attendeesFilter === "attending" && <span className="text-sm font-black text-primary">참석</span>}
                {attendeesFilter === "absent"    && <span className="text-sm font-black text-white/50">불참</span>}
                {attendeesFilter === "waitlist"  && <span className="text-sm font-black text-orange-400">대기</span>}
                <span className="text-sm font-black text-white/30">
                  {attendeesFilter === "attending" ? totalAttending : attendeesFilter === "absent" ? absent.length : waitlist.length}명
                </span>
              </div>
              <button onClick={() => setAttendeesFilter(null)} className="w-9 h-9 flex items-center justify-center text-white/40 hover:text-white transition-colors active:scale-90">
                <span className="material-icons text-lg">close</span>
              </button>
            </div>
            <div className="overflow-y-auto hide-scrollbar p-4">
              {(() => {
                const isAbsent = attendeesFilter === "absent";
                const isWait   = attendeesFilter === "waitlist";
                const isAttending = attendeesFilter === "attending";
                const list = isAttending
                  ? [
                      ...attending.map((a) => ({ id: a.id, name: getMemberName(a), isMerc: false })),
                      ...mercenaries.map((m) => ({ id: `merc-${m.id}`, name: m.name, isMerc: true })),
                    ]
                  : (isAbsent ? absent : waitlist).map((a) => ({ id: a.id, name: getMemberName(a), isMerc: false }));
                const color    = isWait ? "#fb923c" : isAbsent ? "rgba(255,255,255,0.4)" : "#0DF23E";
                const bg       = isWait ? "rgba(249,115,22,0.08)" : isAbsent ? "rgba(255,255,255,0.03)" : "rgba(13,242,62,0.07)";
                const border   = isWait ? "rgba(249,115,22,0.2)"  : isAbsent ? "rgba(255,255,255,0.06)" : "rgba(13,242,62,0.25)";
                return (
                  <div className="grid grid-cols-2 gap-1.5">
                    {list.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 px-2.5 py-2 rounded-xl border"
                        style={{ background: bg, borderColor: border, opacity: isAbsent ? 0.5 : 1 }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black"
                          style={{ background: a.isMerc ? "rgba(249,115,22,0.2)" : isWait ? "rgba(249,115,22,0.2)" : isAbsent ? "rgba(255,255,255,0.08)" : "rgba(13,242,62,0.25)", color: a.isMerc ? "#fb923c" : color }}>
                          {a.name.slice(0, 1)}
                        </div>
                        <span className="text-xs font-bold text-white truncate flex-1">{a.name}</span>
                        {a.isMerc && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400/80">용병</span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
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
