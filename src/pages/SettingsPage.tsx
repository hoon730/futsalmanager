import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSquadStore } from '@/stores/squadStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { ConfirmModal } from '@/components/modals';
import { toast } from '@/stores/toastStore';
import {
  isPushSupported,
  getPermission,
  requestPermission,
  getCurrentSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/pushNotification';
import type { IMember } from '@/types';

export default function SettingsPage() {
  const { squad, addMember, removeMember, updateMember } = useSquadStore();
  const members = squad?.members || [];
  const { user, updateLinkedMember } = useAuthStore();


  // 내 선수 프로필 연결
  const [linkedMemberId, setLinkedMemberId] = useState<string | null>(
    (user?.user_metadata?.member_id as string) ?? null
  );
  const [linkLoading, setLinkLoading] = useState(false);
  const [showLinkPicker, setShowLinkPicker] = useState(false);

  // 매칭된 본인 선수 정보 수정용
  const [showEditMyMember, setShowEditMyMember] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPosition, setEditPosition] = useState<"GK" | "DF" | "MF" | "FW" | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // user 스토어가 업데이트되면 linkedMemberId도 동기화
  useEffect(() => {
    const memberId = (user?.user_metadata?.member_id as string) ?? null;
    setLinkedMemberId(memberId);
  }, [user?.user_metadata?.member_id]);

  const handleLinkMember = async (member: IMember | null) => {
    setLinkLoading(true);
    try {
      await updateLinkedMember(member?.id ?? null);
      // 성공 시에만 로컬 state 업데이트 (authStore의 user도 함께 갱신됨)
      setLinkedMemberId(member?.id ?? null);
      setShowLinkPicker(false);
      toast(member ? `"${member.name}"으로 연결되었습니다` : '선수 프로필 연결이 해제되었습니다');
    } catch {
      // 실패 시 로컬 state 변경하지 않음 (user_metadata와 desync 방지)
      setShowLinkPicker(false);
      toast('연결에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
    } finally {
      setLinkLoading(false);
    }
  };

  // 매칭된 선수 정보 수정 시작 (모달 열기 + 현재값 채우기)
  const handleStartEditMyMember = () => {
    if (!linkedMemberId) return;
    const m = membersOnly.find((x) => x.id === linkedMemberId);
    setEditName(m?.name ?? "");
    setEditPosition((m?.positionKey as "GK" | "DF" | "MF" | "FW" | undefined) ?? null);
    setShowEditMyMember(true);
  };

  const handleSaveMyMember = async () => {
    const trimmed = editName.trim();
    if (!trimmed) { toast("이름을 입력해주세요", "error"); return; }
    setEditSaving(true);
    try {
      const { error } = await supabase.rpc("update_my_linked_member", {
        p_name: trimmed,
        p_position_key: editPosition,
      });
      if (error) throw error;
      // members 명단 새로고침은 다음 동기화에 맡기고 일단 토스트만
      setShowEditMyMember(false);
      toast("내 선수 정보가 저장되었습니다");
    } catch (e) {
      toast(e instanceof Error ? e.message : "저장에 실패했습니다", "error");
    } finally {
      setEditSaving(false);
    }
  };

  // v2: role 기반 관리자 여부 확인
  const [userRole, setUserRole] = useState<string | null>(null);
  useEffect(() => {
    if (!user || !squad?.id) return;
    supabase
      .from("squad_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("squad_id", squad.id)
      .single()
      .then(({ data }) => setUserRole(data?.role ?? null));
  }, [user, squad?.id]);

  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";

  // 푸시 알림 설정
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    setNotifPermission(getPermission());
    getCurrentSubscription().then((sub) => setIsSubscribed(!!sub));
  }, []);

  const handleEnableNotifications = async () => {
    if (!user || !squad?.id) return;
    setNotifLoading(true);
    try {
      const perm = await requestPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        await subscribeToPush(squad.id, user.id);
        setIsSubscribed(true);
        toast('경기 알림이 켜졌습니다');
      }
    } catch {
      toast('알림 설정에 실패했습니다', 'error');
    } finally {
      setNotifLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    if (!user || !squad?.id) return;
    setNotifLoading(true);
    try {
      await unsubscribeFromPush(squad.id, user.id);
      setIsSubscribed(false);
      toast('알림이 해제되었습니다');
    } catch {
      toast('알림 해제에 실패했습니다', 'error');
    } finally {
      setNotifLoading(false);
    }
  };

  // 동호회 회원 (인증 유저) 목록
  interface ISquadUserRow { userId: string; role: "owner" | "admin" | "member"; username: string; }
  const [squadUsers, setSquadUsers] = useState<ISquadUserRow[]>([]);
  const [squadUsersLoading, setSquadUsersLoading] = useState(false);

  const loadSquadUsers = async () => {
    if (!squad?.id) return;
    setSquadUsersLoading(true);
    try {
      const { data: memberRows, error } = await supabase
        .from("squad_members")
        .select("user_id, role")
        .eq("squad_id", squad.id);
      if (error || !memberRows) return;

      const userIds = memberRows.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);
      const profileMap: Record<string, string> = Object.fromEntries(
        (profiles || []).map((p) => [p.id, p.username ?? "알 수 없음"])
      );

      const rows: ISquadUserRow[] = memberRows.map((m) => ({
        userId: m.user_id,
        role: m.role as ISquadUserRow["role"],
        username: profileMap[m.user_id] ?? "알 수 없음",
      }));
      // owner 먼저, 그 다음 admin, 그 다음 member
      rows.sort((a, b) => {
        const order = { owner: 0, admin: 1, member: 2 };
        return order[a.role] - order[b.role];
      });
      setSquadUsers(rows);
    } finally {
      setSquadUsersLoading(false);
    }
  };

  useEffect(() => { loadSquadUsers(); }, [squad?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChangeRole = async (userId: string, newRole: "admin" | "member") => {
    if (!squad?.id || userRole !== "owner") return;
    const { error } = await supabase
      .from("squad_members")
      .update({ role: newRole })
      .eq("squad_id", squad.id)
      .eq("user_id", userId);
    if (error) {
      toast("역할 변경에 실패했습니다", "error");
      return;
    }
    setSquadUsers((prev) =>
      prev.map((u) => (u.userId === userId ? { ...u, role: newRole } : u))
        .sort((a, b) => ({ owner: 0, admin: 1, member: 2 }[a.role] - { owner: 0, admin: 1, member: 2 }[b.role]))
    );
  };

  const handleRemoveSquadMember = (userId: string, username: string) => {
    if (!squad?.id) return;
    setConfirmModal({
      isOpen: true,
      title: "회원 내보내기",
      message: `${username}님을 동호회에서 내보내시겠습니까?`,
      onConfirm: async () => {
        const { error } = await supabase
          .from("squad_members")
          .delete()
          .eq("squad_id", squad.id)
          .eq("user_id", userId);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        if (error) {
          toast("내보내기에 실패했습니다", "error");
          return;
        }
        setSquadUsers((prev) => prev.filter((u) => u.userId !== userId));
        toast(`${username} 멤버를 내보냈습니다`);
      },
    });
  };

  // 상태
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 멤버 추가 모달 상태
  const [addMemberModal, setAddMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');

  // Enter 키로 멤버 추가 확인
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && addMemberModal) {
        e.preventDefault();
        handleAddMemberConfirm();
      } else if (e.key === 'Escape' && addMemberModal) {
        setAddMemberModal(false);
        setNewMemberName('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [addMemberModal, newMemberName]);

  // 모달 상태
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // 정규 멤버만 (용병 제외), 가나다 정렬
  const membersOnly = useMemo(() =>
    [...members.filter(m => !m.isMercenary)].sort((a, b) => a.name.localeCompare(b.name, ['ko', 'en'])),
    [members]
  );
  const ITEMS_PER_PAGE = 5;
  const totalPages = Math.ceil(membersOnly.length / ITEMS_PER_PAGE);

  // 드래그 스크롤 (마우스)
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);
  const hasDragged = useRef(false);

  // 스크롤 핸들러
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    const width = e.currentTarget.clientWidth;
    if (width > 0) setCurrentPage(Math.round(scrollLeft / width));
  };

  const handlePageClick = (i: number) => {
    scrollRef.current?.scrollTo({ left: i * (scrollRef.current.clientWidth), behavior: 'smooth' });
    setCurrentPage(i);
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDragging.current = true;
    hasDragged.current = false;
    dragStartX.current = e.pageX - (scrollRef.current?.offsetLeft ?? 0);
    dragScrollLeft.current = scrollRef.current?.scrollLeft ?? 0;
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !scrollRef.current) return;
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - dragStartX.current) * 1.5;
    if (Math.abs(walk) > 5) {
      hasDragged.current = true;
      e.preventDefault();
      scrollRef.current.scrollLeft = dragScrollLeft.current - walk;
    }
  };

  const onMouseUp = () => {
    if (isDragging.current) {
      const el = scrollRef.current;
      if (el && hasDragged.current) {
        const page = Math.round(el.scrollLeft / el.clientWidth);
        setCurrentPage(page);
        el.scrollTo({ left: page * el.clientWidth, behavior: 'smooth' });
      }
    }
    isDragging.current = false;
  };

  // 멤버 추가 모달 열기
  const handleAddMember = () => {
    setNewMemberName('');
    setAddMemberModal(true);
  };

  // 멤버 추가 확인
  const handleAddMemberConfirm = () => {
    const trimmedName = newMemberName.trim();
    if (!trimmedName) return;

    if (members.some((m) => m.name === trimmedName)) {
      setAddMemberModal(false);
      setNewMemberName('');
      toast('이미 등록된 멤버입니다', 'error');
      return;
    }

    addMember({
      id: Date.now().toString(),
      name: trimmedName,
      active: true,
      createdAt: new Date().toISOString(),
    });

    setAddMemberModal(false);
    setNewMemberName('');
    toast(`${trimmedName} 멤버가 추가되었습니다`);
  };

  // 멤버 삭제
  const handleRemoveMember = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: '멤버 삭제',
      message: `${name} 멤버를 삭제하시겠습니까?`,
      onConfirm: () => {
        removeMember(id);
        setConfirmModal({ ...confirmModal, isOpen: false });
        toast(`${name} 멤버가 삭제되었습니다`);
      },
    });
  };

  return (
    <div className="animate-fade-in flex flex-col min-h-full relative">
      {/* 헤더 */}
      <header className="px-6 pt-12 pb-14">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">
            설정
          </h1>
          <div className="h-1 w-8 bg-primary mt-3 rounded-full shadow-[0_0_10px_#0df23e]"></div>
        </div>
      </header>

      {/* 메인 */}
      <main className="flex-1 px-6">
        {/* 멤버 관리 */}
        <div className="flex items-center justify-between mb-5 mt-1">
          <h2 className="text-base font-black uppercase tracking-widest flex items-center gap-2 text-white/80">
            <span className="material-icons text-sm text-primary">groups</span>멤버 관리
          </h2>
          {isOwnerOrAdmin && (
            <button
              onClick={handleAddMember}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
              style={{ backgroundColor: 'rgba(13,242,62,0.10)', color: '#0DF23E', border: '1px solid rgba(13,242,62,0.25)' }}
            >
              <span className="material-icons text-sm">person_add</span>
              선수 추가
            </button>
          )}
        </div>

        {/* 멤버 수 및 편집 모드 토글 (편집은 운영자/관리자만) */}
        <div className="flex items-center justify-between mb-6 bg-white/5 p-5 rounded-2xl border border-white/5">
          <div className="text-primary font-black text-md italic">
            현재 {membersOnly.length}명
          </div>
          {isOwnerOrAdmin && (
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-black text-xs uppercase tracking-widest transition-all ${
                isEditMode
                  ? 'bg-primary text-background-dark border-primary'
                  : 'bg-white/5 text-white/40 border-white/10'
              }`}
            >
              <span className="material-icons text-sm">{isEditMode ? 'check' : 'edit'}</span>
              {isEditMode ? '완료' : '멤버 편집'}
            </button>
          )}
        </div>

        {/* 멤버 리스트 (페이지네이션) */}
        {membersOnly.length === 0 ? (
          <div className="py-20 text-center">
            <span className="material-icons text-white/10 text-5xl">group_off</span>
            <p className="text-xs text-white/20 mt-4">등록된 멤버가 없습니다</p>
            <p className="text-xs text-white/20 mt-2">오른쪽 하단 버튼을 눌러 멤버를 추가하세요</p>
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            className="flex snap-x snap-mandatory overflow-x-auto hide-scrollbar cursor-grab active:cursor-grabbing select-none"
          >
            {Array.from({ length: totalPages }).map((_, pageIdx) => (
              <div key={pageIdx} className="w-full flex-shrink-0 snap-center space-y-3">
                {membersOnly
                  .slice(pageIdx * ITEMS_PER_PAGE, (pageIdx + 1) * ITEMS_PER_PAGE)
                  .map((member) => (
                    <div
                      key={member.id}
                      className="rounded-2xl p-5 bg-white/5 border border-white/5 hover:bg-white/[0.07] transition-all group"
                    >
                      {/* 상단 행: 아바타 + 이름 + 삭제 */}
                      <div className="flex items-center gap-4">
                        {member.avatarUrl ? (
                          <img
                            className="w-12 h-12 rounded-full object-cover border border-white/10 flex-shrink-0"
                            src={member.avatarUrl}
                            alt={member.name}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border border-white/10 flex-shrink-0">
                            <span className="text-md font-bold">{member.name.slice(0, 1)}</span>
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base text-white truncate">{member.name}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            {member.positionKey && (
                              <span className="text-[10px] text-primary font-black uppercase tracking-widest">
                                {member.positionKey}
                              </span>
                            )}
                            {(member.skillLevel ?? 0) > 0 && (
                              <span className="text-[10px] text-yellow-400/70">
                                {'★'.repeat(member.skillLevel ?? 3)}{'☆'.repeat(5 - (member.skillLevel ?? 3))}
                              </span>
                            )}
                          </div>
                        </div>

                        {isEditMode && isOwnerOrAdmin ? (
                          <button
                            onClick={() => handleRemoveMember(member.id, member.name)}
                            className="w-9 h-9 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/20 flex-shrink-0 transition-all active:scale-95"
                          >
                            <span className="material-icons text-lg">delete</span>
                          </button>
                        ) : !isEditMode ? (
                          <span className="material-icons text-white/10 group-hover:text-primary transition-colors">chevron_right</span>
                        ) : null}
                      </div>

                      {/* 편집 모드 (운영자): 포지션 + 별점 */}
                      {isEditMode && isOwnerOrAdmin && (
                        <div className="mt-3 pt-3 border-t border-white/5 space-y-2.5">
                          {/* 포지션 선택 */}
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/30 w-10 flex-shrink-0">포지션</span>
                            <div className="flex gap-1.5">
                              {(['GK','DF','MF','FW'] as const).map((pos) => (
                                <button
                                  key={pos}
                                  onClick={() => updateMember(member.id, {
                                    positionKey: member.positionKey === pos ? undefined : pos,
                                  })}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all"
                                  style={member.positionKey === pos
                                    ? { backgroundColor: '#0DF23E', color: '#0a150d' }
                                    : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' }
                                  }
                                >
                                  {pos}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 별점 선택 */}
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/30 w-10 flex-shrink-0">실력</span>
                            <div className="flex gap-1">
                              {[1,2,3,4,5].map((star) => (
                                <button
                                  key={star}
                                  onClick={() => updateMember(member.id, {
                                    skillLevel: member.skillLevel === star ? 3 : star,
                                  })}
                                  className="text-xl leading-none transition-all active:scale-90"
                                  style={{ color: star <= (member.skillLevel ?? 3) ? '#FBBF24' : 'rgba(255,255,255,0.12)' }}
                                >
                                  ★
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        )}

        {/* 페이지 인디케이터 */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => handlePageClick(i)}
                className="h-1.5 rounded-full transition-all duration-300"
                style={currentPage === i
                  ? { width: '2rem', backgroundColor: '#0DF23E', boxShadow: '0 0 8px rgba(13,242,62,0.5)' }
                  : { width: '0.5rem', backgroundColor: 'rgba(255,255,255,0.1)' }
                }
              />
            ))}
          </div>
        )}
      </main>

      {/* 동호회 회원 (인증 유저) 섹션 — 운영자/관리자만 표시 */}
      {isOwnerOrAdmin && (
      <div className="px-6 mb-6 mt-14">
        <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
              동호회 회원 {squadUsers.length > 0 ? `· ${squadUsers.length}명` : ""}
            </p>
            <button
              onClick={loadSquadUsers}
              disabled={squadUsersLoading}
              className="text-white/20 hover:text-white/50 transition-colors"
            >
              <span className="material-icons text-sm">refresh</span>
            </button>
          </div>

          {squadUsersLoading ? (
            <p className="text-white/20 text-xs py-2">로딩 중...</p>
          ) : squadUsers.length === 0 ? (
            <p className="text-white/20 text-xs py-2">회원 정보가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {squadUsers.map((u) => {
                const isMe = u.userId === user?.id;
                const roleBadge: Record<string, { label: string; color: string }> = {
                  owner: { label: "OWNER", color: "#FFD700" },
                  admin: { label: "ADMIN", color: "#0DF23E" },
                  member: { label: "MEMBER", color: "rgba(255,255,255,0.3)" },
                };
                const badge = roleBadge[u.role];
                return (
                  <div key={u.userId} className="flex items-center gap-3 py-1.5">
                    {/* 아바타 */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={{ backgroundColor: isMe ? "rgba(13,242,62,0.15)" : "rgba(255,255,255,0.07)", color: isMe ? "#0DF23E" : "rgba(255,255,255,0.5)" }}
                    >
                      {u.username[0]?.toUpperCase() ?? "?"}
                    </div>
                    {/* 이름 */}
                    <span className="flex-1 text-sm font-bold text-white truncate">
                      {u.username}
                      {isMe && <span className="ml-1.5 text-[9px] text-white/30 font-black uppercase tracking-widest">나</span>}
                    </span>
                    {/* 역할 배지 */}
                    <span className="text-[9px] font-black uppercase tracking-widest flex-shrink-0" style={{ color: badge.color }}>
                      {badge.label}
                    </span>
                    {/* owner 전용: 역할 변경 + 내보내기 */}
                    {userRole === "owner" && !isMe && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {u.role === "member" && (
                          <button
                            onClick={() => handleChangeRole(u.userId, "admin")}
                            className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-all"
                            style={{ backgroundColor: "rgba(13,242,62,0.08)", color: "#0DF23E", border: "1px solid rgba(13,242,62,0.2)" }}
                          >
                            관리자↑
                          </button>
                        )}
                        {u.role === "admin" && (
                          <button
                            onClick={() => handleChangeRole(u.userId, "member")}
                            className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-all"
                            style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}
                          >
                            일반↓
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveSquadMember(u.userId, u.username)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                          style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.5)", border: "1px solid rgba(239,68,68,0.15)" }}
                        >
                          <span className="material-icons text-sm">person_remove</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}

      {/* 내 설정 */}
      <div className="px-6 mt-2 mb-5">
        <h2 className="text-base font-black uppercase tracking-widest flex items-center gap-2 text-white/80">
          <span className="material-icons text-sm text-primary">tune</span>내 설정
        </h2>
      </div>

      {/* 내 선수 프로필 연결 (로그인 유저만) */}
      {user && (
        <div className="px-6 mb-6">
          <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3">내 선수 프로필</p>
            {linkedMemberId ? (
              (() => {
                const me = membersOnly.find((m) => m.id === linkedMemberId);
                return (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary text-xs font-bold">
                          {me?.name?.slice(0, 1) ?? '?'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-bold text-sm truncate">
                          {me?.name ?? '알 수 없음'}
                          {me?.positionKey && (
                            <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-primary/70 px-1.5 py-0.5 rounded-md bg-primary/10">
                              {me.positionKey}
                            </span>
                          )}
                        </p>
                        <p className="text-primary text-[10px] font-black uppercase tracking-widest">연결됨</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={handleStartEditMyMember}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                        title="내 선수 정보 수정"
                      >
                        <span className="material-icons text-base">edit</span>
                      </button>
                      <button
                        onClick={() => setShowLinkPicker(true)}
                        disabled={linkLoading}
                        className="text-white/30 hover:text-white text-xs font-black uppercase tracking-widest transition-colors px-2"
                      >
                        변경
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <button
                onClick={() => setShowLinkPicker(true)}
                disabled={linkLoading}
                className="w-full flex items-center gap-3 py-2 text-white/30 hover:text-white/60 transition-colors"
              >
                <span className="material-icons text-sm">link</span>
                <span className="text-xs font-black uppercase tracking-widest">
                  {linkLoading ? '처리 중...' : '내 이름 선택하기'}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 알림 설정 */}
      {isPushSupported() && (
        <div className="px-6 mb-6">
          <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3">경기 알림</p>

            {notifPermission === 'denied' ? (
              <div className="flex items-center gap-3">
                <span className="material-icons text-white/20 text-sm">notifications_off</span>
                <div className="flex-1">
                  <p className="text-white/50 text-xs font-bold">브라우저에서 알림이 차단됨</p>
                  <p className="text-white/20 text-[10px] mt-0.5">브라우저 설정에서 알림을 허용해주세요</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span
                    className="material-icons text-sm flex-shrink-0"
                    style={{ color: isSubscribed ? '#0DF23E' : 'rgba(255,255,255,0.2)' }}
                  >
                    {isSubscribed ? 'notifications_active' : 'notifications_none'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-white/70 text-sm font-bold">새 경기 알림</p>
                    <p className="text-white/30 text-[10px] mt-0.5 truncate">
                      {isSubscribed ? '경기가 추가되면 알림을 받습니다' : '경기 추가 시 알림 받기'}
                    </p>
                  </div>
                </div>
                {/* 토글 스위치 */}
                <button
                  onClick={isSubscribed ? handleDisableNotifications : handleEnableNotifications}
                  disabled={notifLoading}
                  className="relative w-12 h-6 rounded-full transition-all duration-200 flex-shrink-0 disabled:opacity-50"
                  style={{ backgroundColor: isSubscribed ? '#0DF23E' : 'rgba(255,255,255,0.1)' }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200"
                    style={{ left: isSubscribed ? '1.375rem' : '0.125rem' }}
                  />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 내 선수 정보 수정 모달 */}
      {showEditMyMember && createPortal(
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center px-6 z-[9999] animate-fade-in"
          onClick={() => !editSaving && setShowEditMyMember(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: 'rgba(22,28,22,0.98)', border: '1px solid rgba(13,242,62,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black italic uppercase tracking-tighter text-white mb-1">내 선수 정보</h3>
            <p className="text-white/40 text-xs mb-5">동호회에 표시될 이름과 포지션을 수정합니다</p>

            {/* 이름 */}
            <div className="mb-4">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">이름</label>
              <input
                autoFocus
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={20}
                disabled={editSaving}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
                placeholder="동호회 이름"
              />
            </div>

            {/* 포지션 */}
            <div className="mb-4">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">포지션</label>
              <div className="flex gap-2">
                {(['GK','DF','MF','FW'] as const).map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setEditPosition(editPosition === pos ? null : pos)}
                    disabled={editSaving}
                    className="flex-1 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all active:scale-95 border"
                    style={editPosition === pos
                      ? { backgroundColor: '#0DF23E', color: '#0a150d', borderColor: '#0DF23E' }
                      : { backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.08)' }
                    }
                  >
                    {pos}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-white/25 mt-2">선택을 다시 누르면 해제됩니다</p>
            </div>

            {/* 안내 */}
            <div className="mb-5 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
              <p className="text-[10px] text-white/40 leading-relaxed">
                <span className="material-icons align-middle text-xs text-white/30 mr-1">info</span>
                스킬은 공정한 팀 배정을 위해 운영자만 변경할 수 있습니다
              </p>
            </div>

            {/* 액션 */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowEditMyMember(false)}
                disabled={editSaving}
                className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white/40 disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                취소
              </button>
              <button
                onClick={handleSaveMyMember}
                disabled={editSaving || !editName.trim()}
                className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-40"
                style={{ backgroundColor: '#0DF23E', color: '#0a150d' }}
              >
                {editSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 선수 프로필 선택 모달 */}
      {showLinkPicker && createPortal(
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center px-6 z-[9999] animate-fade-in"
          onClick={() => setShowLinkPicker(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 overflow-y-auto"
            style={{ background: 'rgba(22,28,22,0.98)', border: '1px solid rgba(13,242,62,0.15)', maxHeight: '85vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black italic uppercase tracking-tighter text-white mb-1">내 선수 선택</h3>
            <p className="text-white/40 text-xs mb-5">명단에서 나의 이름을 선택하세요</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {membersOnly.map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleLinkMember(member)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    linkedMemberId === member.id
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-white/5 border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    linkedMemberId === member.id ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white/60'
                  }`}>
                    {member.name.slice(0, 1)}
                  </div>
                  <span className={`font-bold text-sm ${linkedMemberId === member.id ? 'text-primary' : 'text-white'}`}>
                    {member.name}
                  </span>
                  {linkedMemberId === member.id && (
                    <span className="material-icons text-primary text-sm ml-auto">check_circle</span>
                  )}
                </button>
              ))}
              {membersOnly.length === 0 && (
                <p className="text-center text-white/20 text-xs py-6">등록된 멤버가 없습니다</p>
              )}
            </div>
            {linkedMemberId && (
              <button
                onClick={() => handleLinkMember(null)}
                className="w-full mt-4 py-3 text-red-400/60 hover:text-red-400 text-xs font-black uppercase tracking-widest transition-colors"
              >
                연결 해제
              </button>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* 멤버 추가 모달 */}
      {addMemberModal && createPortal(
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center px-6 z-[9999] animate-fade-in"
          onClick={() => { setAddMemberModal(false); setNewMemberName(''); }}
        >
          <div
            className="w-full max-w-sm rounded-[2.5rem] p-8 relative overflow-hidden"
            style={{
              background: 'rgba(22,28,22,0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(13,242,62,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black italic uppercase text-white mb-3">멤버 추가</h3>
            <p className="text-xs text-white/50 font-bold leading-relaxed mb-5">추가할 멤버 이름을 입력하세요</p>
            <input
              type="text"
              placeholder="멤버 이름"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-all mb-6"
            />
            <div className="space-y-3">
              <button
                onClick={handleAddMemberConfirm}
                disabled={!newMemberName.trim()}
                className="w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40"
                style={{ backgroundColor: '#0DF23E', color: '#0a150d' }}
              >
                추가
              </button>
              <button
                onClick={() => { setAddMemberModal(false); setNewMemberName(''); }}
                className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-widest bg-white/5 border border-white/10 text-white/40 transition-all active:scale-95 hover:border-primary/30 hover:text-white/60"
              >
                뒤로가기
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ConfirmModal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />

    </div>
  );
}
