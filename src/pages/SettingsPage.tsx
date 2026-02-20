import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSquadStore } from '@/stores/squadStore';
import { useDivisionStore } from '@/stores/divisionStore';
import { useAdminStore } from '@/stores/adminStore';
import { AlertModal, ConfirmModal, AdminPasswordModal } from '@/components/modals';

export default function SettingsPage() {
  const { squad, addMember, removeMember, clearAllData } = useSquadStore();
  const members = squad?.members || [];
  const { clearAllDivisions } = useDivisionStore();
  const { isAdmin, setIsAdmin } = useAdminStore();

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
  const [adminPasswordModal, setAdminPasswordModal] = useState(false);
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: '',
  });
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

    if (members.some((m: any) => m.name === trimmedName)) {
      setAddMemberModal(false);
      setNewMemberName('');
      setAlertModal({ isOpen: true, message: '이미 등록된 멤버입니다' });
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
    setAlertModal({ isOpen: true, message: `${trimmedName} 멤버가 추가되었습니다` });
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
        setAlertModal({ isOpen: true, message: `${name} 멤버가 삭제되었습니다` });
      },
    });
  };

  // 전체 데이터 초기화
  const handleReset = () => {
    if (!isAdmin) {
      setAdminPasswordModal(true);
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: '⚠️ 경고',
      message: '모든 데이터를 초기화하시겠습니까? 이 작업은 취소할 수 없습니다.',
      onConfirm: async () => {
        await clearAllData();
        await clearAllDivisions();
        setConfirmModal({ ...confirmModal, isOpen: false });
        setAlertModal({ isOpen: true, message: '모든 데이터가 초기화되었습니다' });
      },
    });
  };

  // 관리자 비밀번호 확인
  const handleAdminPasswordSubmit = (password: string) => {
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;

    if (password === adminPassword) {
      setIsAdmin(true);
      setAdminPasswordModal(false);
      setAlertModal({ isOpen: true, message: '✅ 관리자 인증 성공' });
      // 인증 후 초기화 진행
      handleReset();
    } else {
      setAdminPasswordModal(false);
      setAlertModal({ isOpen: true, message: '❌ 비밀번호가 틀렸습니다' });
    }
  };

  return (
    <div className="animate-fade-in flex flex-col min-h-full relative">
      {/* 헤더 */}
      <header className="px-6 pt-12 pb-10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">
              멤버 관리
            </h1>
            <div className="h-1 w-8 bg-primary mt-3 rounded-full shadow-[0_0_10px_#0df23e]"></div>
          </div>
          <button
            onClick={handleAddMember}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
            style={{ backgroundColor: '#0DF23E', color: '#0a150d' }}
          >
            <span className="material-icons text-sm">person_add</span>
            추가
          </button>
        </div>
      </header>

      {/* 메인 */}
      <main className="flex-1 px-6">
        {/* 멤버 수 및 편집 모드 토글 */}
        <div className="flex items-center justify-between mb-6 bg-white/5 p-4 rounded-2xl border border-white/5">
          <div className="text-primary font-black text-md italic">
            현재 {membersOnly.length}명
          </div>
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
                      className="rounded-2xl p-4 flex items-center gap-4 bg-white/5 border border-white/5 hover:bg-white/[0.07] transition-all group"
                    >
                      {/* 프로필 이미지 or 첫 글자 */}
                      {member.avatarUrl ? (
                        <img
                          className="w-12 h-12 rounded-full object-cover border border-white/10"
                          src={member.avatarUrl}
                          alt={member.name}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border border-white/10">
                          <span className="text-md font-bold">{member.name.slice(1)}</span>
                        </div>
                      )}

                      {/* 멤버 정보 */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base text-white truncate">{member.name}</h3>
                        {member.positionKey && (
                          <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-0.5">
                            {member.positionKey}
                          </p>
                        )}
                      </div>

                      {isEditMode ?  (
                      // 삭제 버튼 (편집 모드일 때만)
                        <button
                          onClick={() => handleRemoveMember(member.id, member.name)}
                          className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20"
                        >
                          <span className="material-icons text-xl">delete</span>
                        </button>
                      ) : (
                         <span className="material-icons text-white/10 group-hover:text-primary transition-colors">chevron_right</span>
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

      {/* 푸터 - 전체 초기화 버튼 */}
      <footer className="px-6 py-8 mt-auto">
        <button
          onClick={handleReset}
          className="w-full flex items-center justify-center gap-3 p-5 rounded-[2rem] bg-red-500/10 border border-red-500/30 text-red-500 font-black uppercase tracking-[0.1em] text-xs"
        >
          <span className="material-icons text-base">restart_alt</span>
          RESET ALL DATA
        </button>
      </footer>

      {/* 멤버 추가 모달 */}
      {addMemberModal && createPortal(
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-lg flex items-center justify-center px-6 animate-fade-in"
          style={{ zIndex: 9999 }}
          onClick={() => { setAddMemberModal(false); setNewMemberName(''); }}
        >
          <div
            className="w-full max-w-sm rounded-[2.5rem] p-8 relative overflow-hidden"
            style={{
              background: 'rgba(22,38,27,0.95)',
              backdropFilter: 'blur(20px)',
              border: '2px solid rgba(13,242,62,0.3)',
              boxShadow: '0 0 60px rgba(13,242,62,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black italic uppercase text-white mb-3">멤버 추가</h3>
            <p className="text-sm text-white/60 font-medium leading-relaxed mb-6">추가할 멤버 이름을 입력하세요</p>
            <input
              type="text"
              placeholder="멤버 이름"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              autoFocus
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none mb-6 text-white"
              onFocus={e => e.currentTarget.style.borderColor = 'rgba(13,242,62,0.5)'}
              onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
            <div className="space-y-3">
              <button
                onClick={handleAddMemberConfirm}
                disabled={!newMemberName.trim()}
                className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95"
                style={newMemberName.trim()
                  ? { backgroundColor: '#0DF23E', color: '#0a150d' }
                  : { backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.2)', cursor: 'not-allowed' }
                }
              >
                추가
              </button>
              <button
                onClick={() => { setAddMemberModal(false); setNewMemberName(''); }}
                className="w-full py-3.5 rounded-xl text-sm font-black uppercase tracking-[0.2em] transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(13,242,62,0.4)';
                  (e.currentTarget as HTMLButtonElement).style.color = '#0DF23E';
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(13,242,62,0.05)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)';
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
                }}
              >
                뒤로가기
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* AlertModal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        message={alertModal.message}
        onClose={() => setAlertModal({ isOpen: false, message: '' })}
      />

      {/* ConfirmModal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />

      {/* AdminPasswordModal */}
      <AdminPasswordModal
        isOpen={adminPasswordModal}
        onConfirm={handleAdminPasswordSubmit}
        onClose={() => setAdminPasswordModal(false)}
      />
    </div>
  );
}
