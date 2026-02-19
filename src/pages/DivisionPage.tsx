import { useState, useRef, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";

import { useSquadStore } from "@/stores/squadStore";
import { useFixedTeamStore } from "@/stores/fixedTeamStore";
import { useDivisionStore } from "@/stores/divisionStore";
import { divideTeamsWithConstraints, updateTeammateHistory as updateHistory } from "@/lib/teamAlgorithm";
import { saveDivisionToSupabase, syncTeammateHistoryToSupabase } from "@/lib/supabaseSync";
import { AlertModal, ConfirmModal, FixedTeamModal } from "@/components/modals";
import type { IMember, IFixedTeam } from "@/types";

const TEAM_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
const TEAM_NAMES_MAP = ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON'];

const DivisionPage = () => {
  const { squad, selectedParticipants, toggleParticipant, selectAllParticipants, clearAllParticipants } = useSquadStore();
  const { fixedTeams, addFixedTeam, removeFixedTeam } = useFixedTeamStore();
  const { saveDivision, divisionHistory, teammateHistory, updateTeammateHistory: updateStoreHistory } = useDivisionStore();

  const [currentTime, setCurrentTime] = useState('');
  const [currentTeams, setCurrentTeams] = useState<IMember[][] | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  // 참석현황 페이지네이션
  const [activePage, setActivePage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 팀 결과 스와이퍼
  const [activeTeamPage, setActiveTeamPage] = useState(0);
  const teamScrollRef = useRef<HTMLDivElement>(null);

  // 드래그 스크롤 (마우스)
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);
  const hasDragged = useRef(false);

  const isTeamDragging = useRef(false);
  const teamDragStartX = useRef(0);
  const teamDragScrollLeft = useRef(0);
  const hasTeamDragged = useRef(false);

  // 고정팀 상세 모달
  const [selectedFixedTeam, setSelectedFixedTeam] = useState<IFixedTeam | null>(null);

  // 용병 관련
  const [mercenaries, setMercenaries] = useState<IMember[]>(() => {
    const saved = localStorage.getItem('mercenaries');
    return saved ? JSON.parse(saved) : [];
  });
  const [mercenaryName, setMercenaryName] = useState('');
  const [selectedMercenaries, setSelectedMercenaries] = useState<string[]>([]);

  // 모달
  const [showTeamCountModal, setShowTeamCountModal] = useState(false);
  const [showSavePeriodModal, setShowSavePeriodModal] = useState(false);
  const [showFixedTeamModal, setShowFixedTeamModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('mercenaries', JSON.stringify(mercenaries));
  }, [mercenaries]);

  const members = squad?.members || [];
  const sortedMembers = useMemo(() => [...members].sort((a, b) => a.name.localeCompare(b.name, ['ko', 'en'])), [members]);
  const sortedMercenaries = useMemo(() => [...mercenaries].sort((a, b) => a.name.localeCompare(b.name, ['ko', 'en'])), [mercenaries]);

  const attendingCount = selectedParticipants.length;
  const attendingMercenaryCount = selectedMercenaries.length;
  const totalAttending = attendingCount + attendingMercenaryCount;
  const isAllSelected = members.length > 0 && attendingCount === members.length;

  const ITEMS_PER_PAGE = 6;
  const playerChunks = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < sortedMembers.length; i += ITEMS_PER_PAGE) {
      chunks.push(sortedMembers.slice(i, i + ITEMS_PER_PAGE));
    }
    return chunks;
  }, [sortedMembers]);

  // ── 참석현황 스크롤/드래그 ──
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.clientWidth > 0) setActivePage(Math.round(el.scrollLeft / el.clientWidth));
  };
  const handlePageClick = (i: number) => {
    scrollRef.current?.scrollTo({ left: i * (scrollRef.current.clientWidth), behavior: 'smooth' });
    setActivePage(i);
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
        setActivePage(page);
        el.scrollTo({ left: page * el.clientWidth, behavior: 'smooth' });
      }
    }
    isDragging.current = false;
  };

  // ── 팀 결과 스크롤/드래그 ──
  const handleTeamScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.clientWidth > 0) setActiveTeamPage(Math.round(el.scrollLeft / el.clientWidth));
  };
  const handleTeamPageClick = (i: number) => {
    teamScrollRef.current?.scrollTo({ left: i * (teamScrollRef.current.clientWidth), behavior: 'smooth' });
    setActiveTeamPage(i);
  };
  const onTeamMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isTeamDragging.current = true;
    hasTeamDragged.current = false;
    teamDragStartX.current = e.pageX - (teamScrollRef.current?.offsetLeft ?? 0);
    teamDragScrollLeft.current = teamScrollRef.current?.scrollLeft ?? 0;
  };
  const onTeamMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isTeamDragging.current || !teamScrollRef.current) return;
    const x = e.pageX - teamScrollRef.current.offsetLeft;
    const walk = (x - teamDragStartX.current) * 1.5;
    if (Math.abs(walk) > 5) {
      hasTeamDragged.current = true;
      e.preventDefault();
      teamScrollRef.current.scrollLeft = teamDragScrollLeft.current - walk;
    }
  };
  const onTeamMouseUp = () => {
    if (isTeamDragging.current) {
      const el = teamScrollRef.current;
      if (el && hasTeamDragged.current) {
        const page = Math.round(el.scrollLeft / el.clientWidth);
        setActiveTeamPage(page);
        el.scrollTo({ left: page * el.clientWidth, behavior: 'smooth' });
      }
    }
    isTeamDragging.current = false;
  };

  // ── 용병 ──
  const handleAddMercenary = () => {
    const name = mercenaryName.trim();
    if (!name) { setAlertMessage('용병 이름을 입력해주세요'); setShowAlert(true); return; }
    if (mercenaries.some(m => m.name === name)) { setAlertMessage('이미 추가된 용병입니다'); setShowAlert(true); return; }
    if (members.some(m => m.name === name)) { setAlertMessage('정규 멤버와 동일한 이름입니다'); setShowAlert(true); return; }
    const newMercenary: IMember = { id: `mercenary-${Date.now()}`, name, isMercenary: true, active: true, createdAt: new Date().toISOString() };
    setMercenaries([...mercenaries, newMercenary]);
    setSelectedMercenaries([...selectedMercenaries, newMercenary.id]);
    setMercenaryName('');
  };

  const handleRemoveMercenary = (id: string) => {
    setConfirmModal({
      isOpen: true, title: '용병 삭제', message: '이 용병을 삭제하시겠습니까?',
      onConfirm: () => {
        setMercenaries(mercenaries.filter(m => m.id !== id));
        setSelectedMercenaries(selectedMercenaries.filter(mid => mid !== id));
        setConfirmModal({ ...confirmModal, isOpen: false });
      }
    });
  };

  const toggleMercenary = (id: string) => {
    setSelectedMercenaries(prev => prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]);
  };

  // ── 팀 나누기 ──
  const handleDivideTeams = async (teamCount: number) => {
    setShowTeamCountModal(false);
    const selectedMembers = members.filter(m => selectedParticipants.includes(m.id));
    const selectedMercs = mercenaries.filter(m => selectedMercenaries.includes(m.id));
    const allParticipants = [...selectedMembers, ...selectedMercs];
    if (allParticipants.length < teamCount) { setAlertMessage(`최소 ${teamCount}명이 필요합니다`); setShowAlert(true); return; }
    const result = await divideTeamsWithConstraints(allParticipants, teamCount, fixedTeams, teammateHistory);
    if (!result || !result.teams) { setAlertMessage('팀 배정에 실패했습니다. 다시 시도해주세요.'); setShowAlert(true); return; }
    setCurrentTeams(result.teams);
    setActiveTeamPage(0);
    setShowResultModal(true);
  };

  // ── 결과 저장 ──
  const handleSave = async (period: '전반전' | '후반전') => {
    if (!currentTeams || !squad) return;
    const date = new Date();
    const notes = `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. ${period}`;
    const division = { id: Date.now().toString(), squadId: squad.id, divisionDate: date.toISOString(), notes, period, teams: currentTeams, teamCount: currentTeams.length };
    await saveDivisionToSupabase(division);
    saveDivision(division);
    const updatedHistory = updateHistory(currentTeams, teammateHistory);
    updateStoreHistory(updatedHistory);
    await syncTeammateHistoryToSupabase(squad.id, updatedHistory);
    setShowSavePeriodModal(false);
    setAlertMessage(`${period} 결과가 저장되었습니다`);
    setShowAlert(true);
  };

  // ── 고정팀 ──
  const handleAddFixedTeam = (playerIds: string[]) => {
    const newTeam: IFixedTeam = { id: `fixed-${Date.now()}`, playerIds, active: true };
    addFixedTeam(newTeam);
  };

  return (
    <div className="animate-fade-in">
      {/* 헤더 */}
      <header className="px-6 pt-12 pb-10">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">팀 배정</h1>
            <div className="h-1 w-8 mt-3 rounded-full shadow-[0_0_10px_#0df23e]" style={{ backgroundColor: '#0DF23E' }}></div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Match #{divisionHistory.length + 1}</p>
            <p className="text-[10px] font-black uppercase mt-1" style={{ color: '#0DF23E' }}>오늘 {currentTime}</p>
          </div>
        </div>
      </header>

      <section className="space-y-6">
        {/* ── 참석 현황 ── */}
        <div>
          <div className="flex justify-between items-center mb-4 px-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="material-icons text-sm" style={{ color: '#0DF23E' }}>groups</span>
              참석 현황
              <span className="text-xs ml-1" style={{ color: 'rgba(13,242,62,0.6)' }}>({attendingCount}명 선택됨)</span>
            </h2>
            <button
              onClick={() => isAllSelected ? clearAllParticipants() : selectAllParticipants()}
              className={`text-xs font-bold px-4 py-1.5 rounded-full border active:scale-95 transition-all ${
                isAllSelected ? 'text-red-500 bg-red-500/10 border-red-500/20' : 'border-primary/20 bg-primary/10'
              }`}
              style={!isAllSelected ? { color: '#0DF23E' } : {}}
            >
              {isAllSelected ? '전체 해제' : '전체 선택'}
            </button>
          </div>

          {members.length === 0 ? (
            <div className="px-6"><p className="text-center text-white/40 py-8">멤버를 추가해주세요</p></div>
          ) : (
            <div className="relative">
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                className="flex overflow-x-auto hide-scrollbar snap-x snap-mandatory touch-pan-x cursor-grab active:cursor-grabbing select-none"
              >
                {playerChunks.map((chunk, chunkIdx) => (
                  <div key={chunkIdx} className="w-full flex-shrink-0 snap-center px-6">
                    <div className="grid grid-cols-2 gap-3">
                      {chunk.map(member => {
                        const isSelected = selectedParticipants.includes(member.id);
                        return (
                          <div
                            key={member.id}
                            onClick={() => { if (!hasDragged.current) toggleParticipant(member.id); }}
                            className="rounded-[1.25rem] p-4 flex items-center justify-between transition-all cursor-pointer border-2"
                            style={{
                              background: isSelected ? 'rgba(13,242,62,0.08)' : 'rgba(22,38,27,0.8)',
                              backdropFilter: 'blur(12px)',
                              borderColor: isSelected ? '#0DF23E' : 'transparent',
                              opacity: isSelected ? 1 : 0.45,
                            }}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {member.avatarUrl ? (
                                <img alt={member.name} className="w-10 h-10 rounded-full object-cover border border-white/10" src={member.avatarUrl} />
                              ) : (
                                <div className="w-10 h-10 rounded-full flex items-center justify-center border border-white/10" style={{ background: 'rgba(13,242,62,0.2)' }}>
                                  <span className="text-sm font-bold">{member.name.slice(1)}</span>
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-white truncate">{member.name}</p>
                                {member.positionKey && (
                                  <p className="text-[10px] opacity-60 text-slate-300 font-medium uppercase">{member.positionKey}</p>
                                )}
                              </div>
                            </div>
                            <div
                              className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                              style={isSelected ? { backgroundColor: '#0DF23E', borderColor: '#0DF23E' } : { borderColor: 'rgba(255,255,255,0.1)' }}
                            >
                              {isSelected && <span className="material-icons text-[14px] font-black" style={{ color: '#0a150d' }}>check</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {playerChunks.length > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                  {playerChunks.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => handlePageClick(i)}
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={activePage === i
                        ? { width: '2rem', backgroundColor: '#0DF23E', boxShadow: '0 0 8px rgba(13,242,62,0.5)' }
                        : { width: '0.5rem', backgroundColor: 'rgba(255,255,255,0.1)' }
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 space-y-6">
          {/* ── 용병 추가 ── */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="material-icons text-sm" style={{ color: '#0DF23E' }}>person_add</span>
                용병 추가
                <span className="text-xs ml-1" style={{ color: 'rgba(13,242,62,0.6)' }}>({attendingMercenaryCount}명 선택됨)</span>
              </h2>
              <button
                onClick={() => setShowFixedTeamModal(true)}
                className="text-xs font-bold px-4 py-1.5 bg-primary/10 rounded-full border border-primary/20 active:scale-95 transition-all"
                style={{ color: '#0DF23E' }}
              >
                고정팀 설정
              </button>
            </div>
            <div className="glass-card rounded-2xl p-4 space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mercenaryName}
                  onChange={(e) => setMercenaryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMercenary()}
                  placeholder="용병 이름 입력"
                  className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                  style={{ color: 'white' }}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(13,242,62,0.5)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <button
                  onClick={handleAddMercenary}
                  className="px-4 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-transform"
                  style={{ backgroundColor: '#0DF23E', color: '#0a150d' }}
                >
                  추가
                </button>
              </div>

              {mercenaries.length > 0 && (
                <div className="space-y-2 pt-2">
                  {sortedMercenaries.map(merc => {
                    const isSelected = selectedMercenaries.includes(merc.id);
                    return (
                      <div
                        key={merc.id}
                        onClick={() => toggleMercenary(merc.id)}
                        className="flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all"
                        style={{
                          background: isSelected ? 'rgba(13,242,62,0.05)' : 'rgba(0,0,0,0.2)',
                          borderColor: isSelected ? 'rgba(13,242,62,0.2)' : 'rgba(255,255,255,0.05)',
                          opacity: isSelected ? 1 : 0.5,
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                            style={isSelected ? { backgroundColor: '#0DF23E', borderColor: '#0DF23E' } : { borderColor: 'rgba(255,255,255,0.1)' }}
                          >
                            {isSelected && <span className="material-icons text-[14px]" style={{ color: '#0a150d' }}>check</span>}
                          </div>
                          <span className="text-sm font-bold">{merc.name}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-orange-500/20 text-orange-500 rounded-full font-bold">용병</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveMercenary(merc.id); }}
                          className="text-xs font-bold px-3 py-1 rounded-full border text-red-400 bg-red-500/10 border-red-500/20 active:scale-95 transition-all"
                        >
                          삭제
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── 고정 팀 현황 ── */}
          {fixedTeams.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <span className="material-icons text-sm" style={{ color: '#0DF23E' }}>lock</span>
                고정팀 현황
              </h2>
              <div className="space-y-2">
                {fixedTeams.map((team, idx) => {
                  const teamMembers = team.playerIds.map(id =>
                    members.find(m => m.id === id) || mercenaries.find(m => m.id === id)
                  ).filter(Boolean);
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedFixedTeam(team)}
                      className="flex items-center justify-between p-4 rounded-xl animate-fade-in cursor-pointer transition-all hover:bg-primary/10"
                      style={{ background: 'rgba(13,242,62,0.05)', border: '1px solid rgba(13,242,62,0.2)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          {teamMembers.map((m, i) => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(13,242,62,0.2)', borderColor: '#0a150d' }}>
                              {m?.name.slice(1)}
                            </div>
                          ))}
                        </div>
                        <span className="text-[11px] font-black uppercase font-normal tracking-widest" style={{ color: '#0DF23E' }}>고정팀 설정됨</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFixedTeam(team.id); }}
                        className="text-xs font-bold px-3 py-1 rounded-full border text-red-400 bg-red-500/10 border-red-500/20 active:scale-95 transition-all"
                      >
                        삭제
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 통계 카드 ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center gap-2 border border-white/5">
              <p className="text-[10px] uppercase tracking-wider opacity-60 font-black">멤버 인원</p>
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm font-bold text-white/80">멤버 <span style={{ color: '#0DF23E' }}>{members.length}명</span></p>
                <p className="text-sm font-bold text-white/80">용병 <span style={{ color: '#0DF23E' }}>{mercenaries.length}명</span></p>
              </div>
            </div>
            <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center gap-2 border border-white/5">
              <p className="text-[10px] uppercase tracking-wider opacity-60 font-black">참석 인원</p>
              <span className="text-2xl font-black" style={{ color: '#0DF23E' }}>{totalAttending}명</span>
            </div>
          </div>

          {/* ── DIVIDE INTO TEAMS 버튼 ── */}
          <div className="pt-6 pb-4">
            <button
              onClick={() => setShowTeamCountModal(true)}
              disabled={totalAttending < 2}
              className="w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all"
              style={totalAttending < 2
                ? { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.2)', cursor: 'not-allowed' }
                : { backgroundColor: '#0DF23E', color: '#0a150d', boxShadow: '0 10px 40px rgba(13,242,62,0.3)' }
              }
            >
              <span className="material-icons">shuffle</span>
              팀 나누기
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          팀 개수 선택 모달
      ══════════════════════════════════════ */}
      {showTeamCountModal && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center px-6" style={{ zIndex: 9000 }} onClick={() => setShowTeamCountModal(false)}>
          <div
            className="w-full max-w-sm rounded-[2.5rem] p-8 relative overflow-hidden animate-fade-in"
            style={{ background: 'rgba(22,38,27,0.95)', backdropFilter: 'blur(20px)', border: '2px solid rgba(13,242,62,0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5" style={{ background: 'rgba(13,242,62,0.1)', border: '1px solid rgba(13,242,62,0.2)' }}>
                <span className="material-icons text-3xl" style={{ color: '#0DF23E' }}>grid_view</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white uppercase italic">팀 개수 설정</h2>
              <p className="text-xs text-white/40 mt-3 font-medium">경기를 진행할 최적의 팀 개수를 선택하세요</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-10">
              {[2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  onClick={() => handleDivideTeams(num)}
                  className="relative rounded-[1.5rem] p-6 flex flex-col items-center justify-center transition-all group"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.05)' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#0DF23E';
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(13,242,62,0.1)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(13,242,62,0.2)';
                    (e.currentTarget.querySelector('.num-text') as HTMLElement).style.color = '#0DF23E';
                    (e.currentTarget.querySelector('.teams-text') as HTMLElement).style.color = 'rgba(13,242,62,0.8)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.05)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                    (e.currentTarget.querySelector('.num-text') as HTMLElement).style.color = 'rgba(255,255,255,0.2)';
                    (e.currentTarget.querySelector('.teams-text') as HTMLElement).style.color = 'rgba(255,255,255,0.1)';
                  }}
                >
                  <span className="num-text text-4xl font-black italic transition-colors" style={{ color: 'rgba(255,255,255,0.2)' }}>{num}</span>
                  <span className="teams-text text-[9px] mt-2 font-black tracking-[0.2em] uppercase transition-colors" style={{ color: 'rgba(255,255,255,0.1)' }}>TEAMS</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowTeamCountModal(false)}
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
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════
          팀 배정 결과 모달
      ══════════════════════════════════════ */}
      {showResultModal && currentTeams && createPortal(
        <div className="fixed inset-0 flex justify-center flex-col animate-fade-in" style={{ zIndex: 9000, background: 'rgba(10, 21, 13)' }}>

          {/* ① 헤더 - 고정 */}
          <div className="px-6 pt-10 pb-8 flex items-center justify-between flex-shrink-0">
            <div>
              <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">팀 배정 결과</h1>
              <div className="h-1 w-8 mt-1.5 rounded-full" style={{ backgroundColor: '#0DF23E' }}></div>
            </div>
            <button
              onClick={() => setShowSavePeriodModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
              style={{ backgroundColor: '#0DF23E', color: '#0a150d' }}
            >
              <span className="material-icons text-sm">save</span>
              저장
            </button>
          </div>

          <div className="pb-5">
            {/* ② 카드 스와이퍼 */}
            <div
              ref={teamScrollRef}
              onScroll={handleTeamScroll}
              onMouseDown={onTeamMouseDown}
              onMouseMove={onTeamMouseMove}
              onMouseUp={onTeamMouseUp}
              onMouseLeave={onTeamMouseUp}
              className="flex overflow-x-auto hide-scrollbar snap-x snap-mandatory touch-pan-x cursor-grab active:cursor-grabbing select-none flex-shrink-0"
            >
              {currentTeams.map((team, idx) => {
                const color = TEAM_COLORS[idx % TEAM_COLORS.length];
                const teamName = TEAM_NAMES_MAP[idx] ?? `TEAM ${idx + 1}`;
                return (
                  <div key={idx} className="w-full flex-shrink-0 snap-center px-5 py-2">
                    <div
                      className="rounded-[3rem] p-8 flex flex-col relative overflow-hidden"
                      style={{
                        border: `3px solid ${color}`,
                        boxShadow: `0 0 30px ${color}18`,
                      }}
                    >
                      {/* 배경 축구공 - 우측 상단 */}
                      <div className="absolute top-6 right-5 pointer-events-none select-none opacity-[0.04]">
                        <span className="material-icons" style={{ fontSize: '11rem', lineHeight: 1 }}>sports_soccer</span>
                      </div>
  
                      {/* 팀 헤더 */}
                      <div className="flex justify-between items-start mb-5 relative z-10">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 block" style={{ color }}>TEAM {idx + 1}</span>
                          <h2 className="text-4xl font-black italic uppercase leading-none tracking-tighter">{teamName}</h2>
                        </div>
                        <div className="w-20 h-20 rounded-full border border-white/10 bg-white/5 flex flex-col items-center justify-center relative group">
                          <span className="text-2xl font-black leading-none">{team.length}</span>
                          <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-1">PLAYERS</span>
                          <div className="absolute inset-0 rounded-full blur-xl transition-all group-hover:blur-2xl" style={{ backgroundColor: color, opacity: 0.1 }}></div>
                        </div>
                      </div>
  
                      {/* 선수 리스트 - 5명까지, 초과 시 스크롤 */}
                      <div
                        className="z-10 relative overflow-y-auto hide-scrollbar flex flex-col gap-2"
                        style={{ maxHeight: 'calc(5 * 2.6rem + 4 * 0.5rem)' }}
                      >
                        {team.map((member, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 px-3 rounded-xl flex-shrink-0"
                            style={{
                              background: `linear-gradient(135deg, ${color}18 0%, ${color}0C 100%)`,
                              border: `1px solid ${color}30`,
                              height: '2.6rem',
                            }}
                          >
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0"
                              style={{ background: `${color}40`, color: '#fff' }}
                            >
                              {member.name.slice(1)}
                            </div>
                            <span className="font-semibold text-sm text-white/90 flex-1 truncate">{member.name}</span>
                            {member.isMercenary && (
                              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 bg-orange-500/20 text-orange-400">용병</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
  
            {/* ③ 페이지네이션 도트 */}
            <div className="flex justify-center gap-2 py-2.5 flex-shrink-0">
              {currentTeams.map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleTeamPageClick(i)}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={activeTeamPage === i
                    ? { width: '2rem', backgroundColor: '#0DF23E', boxShadow: '0 0 8px rgba(13,242,62,0.5)' }
                    : { width: '0.5rem', backgroundColor: 'rgba(255,255,255,0.1)' }
                  }
                />
              ))}
            </div>
          </div>

          {/* ④ 하단 버튼 - 고정 */}
          <div className="px-5 pt-1 pb-10 space-y-2.5 flex-shrink-0">
            <button
              onClick={() => handleDivideTeams(currentTeams.length)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 text-sm"
              style={{ backgroundColor: '#0DF23E', color: '#0a150d' }}
            >
              <span className="material-icons text-lg">autorenew</span>
              팀 다시 섞기
            </button>
            <button
              onClick={() => setShowResultModal(false)}
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

        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════
          저장 모달
      ══════════════════════════════════════ */}
      {showSavePeriodModal && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center px-6" style={{ zIndex: 9100 }} onClick={() => setShowSavePeriodModal(false)}>
          <div
            className="w-full max-w-sm rounded-[2.5rem] p-8 relative overflow-hidden animate-fade-in"
            style={{ background: 'rgba(22,38,27,0.95)', backdropFilter: 'blur(20px)', border: '2px solid rgba(13,242,62,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5" style={{ background: 'rgba(13,242,62,0.1)', border: '1px solid rgba(13,242,62,0.2)' }}>
                <span className="material-icons text-3xl" style={{ color: '#0DF23E' }}>save</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white uppercase italic">팀 결과 저장</h2>
              <p className="text-xs text-white/40 mt-3 font-medium">어느 시간대로 저장하시겠습니까?</p>
            </div>
            <div className="flex gap-4 mb-4">
              {/* 전반전 버튼 - 파랑 호버 */}
              <button
                onClick={() => handleSave('전반전')}
                className="flex-1 py-6 rounded-2xl font-black uppercase transition-all active:scale-95 flex flex-col items-center gap-2"
                style={{ background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
                onMouseEnter={e => {
                  const el = e.currentTarget;
                  el.style.borderColor = 'rgba(59,130,246,0.7)';
                  el.style.color = '#3b82f6';
                  el.style.background = 'rgba(59,130,246,0.08)';
                  el.style.boxShadow = '0 0 20px rgba(59,130,246,0.2)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget;
                  el.style.borderColor = 'rgba(255,255,255,0.1)';
                  el.style.color = 'rgba(255,255,255,0.7)';
                  el.style.background = 'rgba(255,255,255,0.05)';
                  el.style.boxShadow = 'none';
                }}
              >
                <span className="material-icons text-3xl">arrow_left</span>
                <span className="text-xs tracking-widest">전반전</span>
              </button>
              {/* 후반전 버튼 - 빨강 호버 */}
              <button
                onClick={() => handleSave('후반전')}
                className="flex-1 py-6 rounded-2xl font-black uppercase transition-all active:scale-95 flex flex-col items-center gap-2"
                style={{ background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
                onMouseEnter={e => {
                  const el = e.currentTarget;
                  el.style.borderColor = 'rgba(239,68,68,0.7)';
                  el.style.color = '#ef4444';
                  el.style.background = 'rgba(239,68,68,0.08)';
                  el.style.boxShadow = '0 0 20px rgba(239,68,68,0.2)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget;
                  el.style.borderColor = 'rgba(255,255,255,0.1)';
                  el.style.color = 'rgba(255,255,255,0.7)';
                  el.style.background = 'rgba(255,255,255,0.05)';
                  el.style.boxShadow = 'none';
                }}
              >
                <span className="material-icons text-3xl">arrow_right</span>
                <span className="text-xs tracking-widest">후반전</span>
              </button>
            </div>
            <button
              onClick={() => setShowSavePeriodModal(false)}
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
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════
          고정팀 상세 모달
      ══════════════════════════════════════ */}
      {selectedFixedTeam && (() => {
        const teamMembers = selectedFixedTeam.playerIds.map(id =>
          members.find(m => m.id === id) || mercenaries.find(m => m.id === id)
        ).filter(Boolean);
        return createPortal(
          <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center px-6 animate-fade-in" style={{ zIndex: 9200 }} onClick={() => setSelectedFixedTeam(null)}>
            <div
              className="w-full max-w-sm rounded-[2.5rem] p-8 animate-fade-in"
              style={{ background: 'rgba(22,38,27,0.95)', backdropFilter: 'blur(20px)', border: '2px solid rgba(13,242,62,0.2)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: 'rgba(13,242,62,0.1)', border: '1px solid rgba(13,242,62,0.2)' }}>
                  <span className="material-icons text-3xl" style={{ color: '#0DF23E' }}>lock</span>
                </div>
                <h2 className="text-xl font-black italic uppercase text-white">고정팀</h2>
                <p className="text-xs text-white/40 mt-2">이 두 플레이어는 항상 같은 팀입니다</p>
              </div>
              <div className="space-y-3 mb-8">
                {teamMembers.map((m, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: 'rgba(13,242,62,0.05)', border: '1px solid rgba(13,242,62,0.15)' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm" style={{ background: 'rgba(13,242,62,0.2)', color: '#0DF23E' }}>
                      {m?.name.slice(1)}
                    </div>
                    <span className="text-base font-bold text-white">{m?.name}</span>
                    {m?.isMercenary && <span className="ml-auto text-[10px] px-2 py-0.5 bg-orange-500/20 text-orange-500 rounded-full font-bold">용병</span>}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setSelectedFixedTeam(null)}
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
          </div>,
          document.body
        );
      })()}

      {/* Alert / Confirm / FixedTeam 모달 */}
      <AlertModal isOpen={showAlert} message={alertMessage} onClose={() => setShowAlert(false)} />
      <ConfirmModal
        isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message}
        onConfirm={confirmModal.onConfirm} onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
      {showFixedTeamModal && (
        <FixedTeamModal
          members={members} mercenaries={mercenaries}
          selectedParticipants={selectedParticipants} selectedMercenaries={selectedMercenaries}
          fixedTeams={fixedTeams} onClose={() => setShowFixedTeamModal(false)} onAddFixedTeam={handleAddFixedTeam}
        />
      )}
    </div>
  );
};

export default DivisionPage;
