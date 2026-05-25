import { useState, useRef, useMemo, useEffect } from 'react';
import { useSquadStore } from '@/stores/squadStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { ConfirmModal } from '@/components/modals';
import { toast } from '@/stores/toastStore';
import { toFriendlyMessage } from '@/lib/errorMessage';
import type { IMember } from '@/types';
import { EditMyMemberModal } from '@/components/settings/EditMyMemberModal';
import { MemberEditModal } from '@/components/settings/MemberEditModal';
import { LinkMemberModal } from '@/components/settings/LinkMemberModal';
import { AddMemberModal } from '@/components/settings/AddMemberModal';
import { NotificationsSection } from '@/components/settings/NotificationsSection';
import { SquadUsersSection } from '@/components/settings/SquadUsersSection';

export default function SettingsPage() {
  const { squad, addMember, removeMember, updateMember } = useSquadStore();
  const members = squad?.members || [];
  const { user, updateLinkedMember, linkKakao } = useAuthStore();


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
  // 내 선수 프로필 카드 케밥 메뉴
  const [showMyProfileMenu, setShowMyProfileMenu] = useState(false);
  // 관리자용 멤버 편집 모달
  const [editingMember, setEditingMember] = useState<IMember | null>(null);

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

  const handleEditMemberSubmit = (updates: { name: string; positionKey?: "GK" | "DF" | "MF" | "FW"; skillLevel: number }) => {
    if (!editingMember) return;
    updateMember(editingMember.id, updates);
    toast(`${updates.name} 정보가 수정되었습니다`);
    setEditingMember(null);
  };

  /** 멤버 사진 업로드 후 DB + 로컬 store 동기화 */
  const handleMemberAvatarUpload = async (memberId: string, url: string) => {
    const { error } = await supabase
      .from("members")
      .update({ avatar_url: url })
      .eq("id", memberId);
    if (error) throw error;
    updateMember(memberId, { avatarUrl: url });
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
      // members 테이블 realtime은 비활성화돼 있으므로 로컬 state를 직접 갱신
      // (앱 재시작 없이 즉시 반영하기 위함)
      if (linkedMemberId) {
        updateMember(linkedMemberId, {
          name: trimmed,
          positionKey: editPosition ?? undefined,
        });
      }
      setShowEditMyMember(false);
      toast("내 선수 정보가 저장되었습니다");
    } catch (e) {
      toast(toFriendlyMessage(e, "저장에 실패했습니다"), "error");
    } finally {
      setEditSaving(false);
    }
  };

  // v2: role 기반 관리자 여부 확인
  const [userRole, setUserRole] = useState<string | null>(null);
  useEffect(() => {
    if (!user || !squad?.id) return;
    // squad 전환 시 이전 동호회의 role이 잠깐 노출되지 않도록 즉시 초기화
    setUserRole(null);
    let cancelled = false;
    supabase
      .from("squad_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("squad_id", squad.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setUserRole(data?.role ?? null);
      });
    return () => { cancelled = true; };
  }, [user?.id, squad?.id]);

  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";

  // 푸시 알림 설정
  // 카카오 계정 연결
  const [kakaoLinkLoading, setKakaoLinkLoading] = useState(false);
  const hasKakaoLinked = user?.identities?.some((i) => i.provider === "kakao") ?? false;

  const handleLinkKakao = async () => {
    setKakaoLinkLoading(true);
    try {
      await linkKakao();
      // linkIdentity는 OAuth 리다이렉트를 트리거하므로 이 줄 이후 코드는 실행되지 않음
    } catch (e) {
      toast(toFriendlyMessage(e, "카카오 연결에 실패했습니다"), "error");
      setKakaoLinkLoading(false);
    }
  };

  // 동호회 회원 (인증 유저) 섹션은 SquadUsersSection 으로 분리됨
  // 알림 설정 섹션은 NotificationsSection 으로 분리됨

  // 상태
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 멤버 추가 모달 상태
  const [addMemberModal, setAddMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');

  // ESC 키로 모달 닫기 (Enter는 AddMemberModal 내부 input에서 처리)
  useEffect(() => {
    if (!addMemberModal) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAddMemberModal(false);
        setNewMemberName('');
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [addMemberModal]);

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

        {/* 현재 멤버 수 */}
        <div className="mb-6 bg-white/5 p-5 rounded-2xl border border-white/5">
          <div className="text-primary font-black text-md italic">
            현재 {membersOnly.length}명
          </div>
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
                      onClick={isOwnerOrAdmin ? () => setEditingMember(member) : undefined}
                      className={`rounded-2xl p-5 bg-white/5 border border-white/5 hover:bg-white/[0.07] transition-all group${isOwnerOrAdmin ? ' cursor-pointer active:scale-[0.98]' : ''}`}
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
                            {isOwnerOrAdmin && (member.skillLevel ?? 0) > 0 && (
                              <span className="text-[10px] text-yellow-400/70">
                                {'★'.repeat(member.skillLevel ?? 3)}{'☆'.repeat(5 - (member.skillLevel ?? 3))}
                              </span>
                            )}
                          </div>
                        </div>

                        {isOwnerOrAdmin && (
                          <span className="material-icons text-white/10 group-hover:text-primary transition-colors">chevron_right</span>
                        )}
                      </div>

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
      {squad?.id && (
        <SquadUsersSection
          squadId={squad.id}
          isOwnerOrAdmin={isOwnerOrAdmin}
          userRole={userRole}
          currentUserId={user?.id ?? null}
        />
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
                    {/* 케밥 메뉴 */}
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setShowMyProfileMenu((v) => !v)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors active:scale-90"
                        title="더보기"
                      >
                        <span className="material-icons text-lg">more_vert</span>
                      </button>
                      {showMyProfileMenu && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowMyProfileMenu(false)} />
                          <div
                            className="absolute right-0 top-10 z-20 rounded-xl overflow-hidden whitespace-nowrap shadow-lg min-w-[140px]"
                            style={{ background: "rgba(28,34,28,0.98)", border: "1px solid rgba(255,255,255,0.08)" }}
                          >
                            <button
                              onClick={() => { handleStartEditMyMember(); setShowMyProfileMenu(false); }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-white/80 hover:bg-white/5 transition-colors"
                            >
                              <span className="material-icons text-white/50" style={{ fontSize: "14px" }}>edit</span>
                              정보 수정
                            </button>
                            <button
                              onClick={() => { setShowLinkPicker(true); setShowMyProfileMenu(false); }}
                              disabled={linkLoading}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-white/80 hover:bg-white/5 transition-colors border-t border-white/5 disabled:opacity-40"
                            >
                              <span className="material-icons text-white/50" style={{ fontSize: "14px" }}>swap_horiz</span>
                              선수 변경
                            </button>
                            <button
                              onClick={() => { handleLinkMember(null); setShowMyProfileMenu(false); }}
                              disabled={linkLoading}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/5 disabled:opacity-40"
                            >
                              <span className="material-icons text-red-400/70" style={{ fontSize: "14px" }}>link_off</span>
                              연결 해제
                            </button>
                          </div>
                        </>
                      )}
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

      {/* 연결된 계정 (소셜 로그인 연결) */}
      {user && (
        <div className="px-6 mb-6">
          <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3">연결된 계정</p>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* 카카오 아이콘 */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: hasKakaoLinked ? "#FEE500" : "rgba(255,255,255,0.07)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                    <path
                      d="M9 1.5C4.86 1.5 1.5 4.19 1.5 7.5c0 2.07 1.2 3.9 3.04 5.03l-.77 2.84a.25.25 0 0 0 .38.27L7.6 13.5c.45.07.92.1 1.4.1 4.14 0 7.5-2.69 7.5-6S13.14 1.5 9 1.5Z"
                      fill={hasKakaoLinked ? "#3C1E1E" : "rgba(255,255,255,0.2)"}
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-white/70 text-sm font-bold">카카오</p>
                  <p className="text-[10px] mt-0.5" style={{ color: hasKakaoLinked ? "#0DF23E" : "rgba(255,255,255,0.2)" }}>
                    {hasKakaoLinked ? "연결됨" : "연결 안됨"}
                  </p>
                </div>
              </div>
              {!hasKakaoLinked && (
                <button
                  onClick={handleLinkKakao}
                  disabled={kakaoLinkLoading}
                  className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40"
                  style={{ backgroundColor: "rgba(254,229,0,0.15)", color: "#FEE500", border: "1px solid rgba(254,229,0,0.3)" }}
                >
                  {kakaoLinkLoading ? "이동 중..." : "연결하기"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 알림 설정 — NotificationsSection 으로 분리 */}
      <NotificationsSection userId={user?.id ?? null} squadId={squad?.id ?? null} />

      {/* 관리자 멤버 편집 모달 */}
      {editingMember && isOwnerOrAdmin && (
        <MemberEditModal
          memberId={editingMember.id}
          name={editingMember.name}
          position={(editingMember.positionKey as "GK" | "DF" | "MF" | "FW") ?? null}
          skillLevel={editingMember.skillLevel ?? 3}
          avatarUrl={editingMember.avatarUrl}
          onClose={() => setEditingMember(null)}
          onSubmit={handleEditMemberSubmit}
          onAvatarChange={async (url) => {
            await handleMemberAvatarUpload(editingMember.id, url);
            setEditingMember((prev) => prev ? { ...prev, avatarUrl: url } : prev);
          }}
          onDelete={() => {
            const target = editingMember;
            setEditingMember(null);
            handleRemoveMember(target.id, target.name);
          }}
        />
      )}

      {/* 내 선수 정보 수정 모달 */}
      {showEditMyMember && linkedMemberId && (
        <EditMyMemberModal
          memberId={linkedMemberId}
          name={editName}
          position={editPosition}
          avatarUrl={membersOnly.find((m) => m.id === linkedMemberId)?.avatarUrl}
          saving={editSaving}
          onChangeName={setEditName}
          onChangePosition={setEditPosition}
          onAvatarChange={(url) => handleMemberAvatarUpload(linkedMemberId, url)}
          onClose={() => setShowEditMyMember(false)}
          onSubmit={handleSaveMyMember}
        />
      )}

      {/* 선수 프로필 선택 모달 */}
      {showLinkPicker && (
        <LinkMemberModal
          members={membersOnly}
          linkedMemberId={linkedMemberId}
          currentUserId={user?.id ?? null}
          onClose={() => setShowLinkPicker(false)}
          onLink={handleLinkMember}
        />
      )}

      {/* 멤버 추가 모달 */}
      {addMemberModal && (
        <AddMemberModal
          name={newMemberName}
          onChangeName={setNewMemberName}
          onClose={() => { setAddMemberModal(false); setNewMemberName(''); }}
          onConfirm={handleAddMemberConfirm}
        />
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
