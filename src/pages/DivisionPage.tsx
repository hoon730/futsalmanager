import { useState, useRef, useMemo, useEffect } from "react";
// @ts-expect-error - CSS import
import "swiper/css";

import { useSquadStore } from "@/stores/squadStore";
import { useFixedTeamStore } from "@/stores/fixedTeamStore";
import { useDivisionStore } from "@/stores/divisionStore";
import { divideTeamsWithConstraints, updateTeammateHistory as updateHistory } from "@/lib/teamAlgorithm";
import { saveDivisionToSupabase, syncTeammateHistoryToSupabase } from "@/lib/supabaseSync";
import { AlertModal, ConfirmModal } from "@/components/modals";
import type { IMember } from "@/types";

const DivisionPage = () => {
  const { squad, selectedParticipants, toggleParticipant, selectAllParticipants, clearAllParticipants } = useSquadStore();
  const { fixedTeams } = useFixedTeamStore();
  const { saveDivision, teammateHistory, updateTeammateHistory: updateStoreHistory } = useDivisionStore();

  // 현재 시간
  const [currentTime, setCurrentTime] = useState('');

  // 팀 배정 결과
  const [currentTeams, setCurrentTeams] = useState<IMember[][] | null>(null);

  // 페이지네이션
  const [activePage, setActivePage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

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
  const [alertMessage, setAlertMessage] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // 실시간 시간 업데이트
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

  // 용병 저장
  useEffect(() => {
    localStorage.setItem('mercenaries', JSON.stringify(mercenaries));
  }, [mercenaries]);

  // 계산된 값들
  const members = squad?.members || [];
  const sortedMembers = useMemo(() => [...members].sort((a, b) => a.name.localeCompare(b.name, ['ko', 'en'])), [members]);
  const sortedMercenaries = useMemo(() => [...mercenaries].sort((a, b) => a.name.localeCompare(b.name, ['ko', 'en'])), [mercenaries]);

  const attendingCount = selectedParticipants.length;
  const attendingMercenaryCount = selectedMercenaries.length;
  const totalAttending = attendingCount + attendingMercenaryCount;
  const isAllSelected = members.length > 0 && attendingCount === members.length;

  // 페이지네이션
  const ITEMS_PER_PAGE = 6;
  const playerChunks = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < sortedMembers.length; i += ITEMS_PER_PAGE) {
      chunks.push(sortedMembers.slice(i, i + ITEMS_PER_PAGE));
    }
    return chunks;
  }, [sortedMembers]);


  // 용병 추가
  const handleAddMercenary = () => {
    const name = mercenaryName.trim();
    if (!name) {
      setAlertMessage('용병 이름을 입력해주세요');
      setShowAlert(true);
      return;
    }

    if (mercenaries.some(m => m.name === name)) {
      setAlertMessage('이미 추가된 용병입니다');
      setShowAlert(true);
      return;
    }

    if (members.some(m => m.name === name)) {
      setAlertMessage('정규 멤버와 동일한 이름입니다');
      setShowAlert(true);
      return;
    }

    const newMercenary: IMember = {
      id: `mercenary-${Date.now()}`,
      name,
      isMercenary: true,
      active: true,
      createdAt: new Date().toISOString(),
    };

    setMercenaries([...mercenaries, newMercenary]);
    setSelectedMercenaries([...selectedMercenaries, newMercenary.id]);
    setMercenaryName('');
  };

  // 용병 삭제
  const handleRemoveMercenary = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '용병 삭제',
      message: '이 용병을 삭제하시겠습니까?',
      onConfirm: () => {
        setMercenaries(mercenaries.filter(m => m.id !== id));
        setSelectedMercenaries(selectedMercenaries.filter(mid => mid !== id));
        setConfirmModal({ ...confirmModal, isOpen: false });
      }
    });
  };

  // 용병 토글
  const toggleMercenary = (id: string) => {
    setSelectedMercenaries(prev =>
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
  };

  // 팀 나누기
  const handleDivideTeams = async (teamCount: number) => {
    setShowTeamCountModal(false);

    const selectedMembers = members.filter(m => selectedParticipants.includes(m.id));
    const selectedMercs = mercenaries.filter(m => selectedMercenaries.includes(m.id));
    const allParticipants = [...selectedMembers, ...selectedMercs];

    if (allParticipants.length < teamCount) {
      setAlertMessage(`최소 ${teamCount}명이 필요합니다`);
      setShowAlert(true);
      return;
    }

    const result = await divideTeamsWithConstraints(allParticipants, teamCount, fixedTeams, teammateHistory);

    if (!result || !result.teams) {
      setAlertMessage('팀 배정에 실패했습니다. 다시 시도해주세요.');
      setShowAlert(true);
      return;
    }

    setCurrentTeams(result.teams);
  };

  // 결과 저장
  const handleSave = async (period: '전반전' | '후반전') => {
    if (!currentTeams || !squad) return;

    const date = new Date();
    const notes = `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. ${period}`;

    const division = {
      id: Date.now().toString(),
      squadId: squad.id,
      divisionDate: date.toISOString(),
      notes,
      period,
      teams: currentTeams,
      teamCount: currentTeams.length,
    };

    await saveDivisionToSupabase(division);
    saveDivision(division);

    const updatedHistory = updateHistory(currentTeams, teammateHistory);
    updateStoreHistory(updatedHistory);
    await syncTeammateHistoryToSupabase(squad.id, updatedHistory);

    setShowSavePeriodModal(false);
    setAlertMessage(`${period} 결과가 저장되었습니다`);
    setShowAlert(true);
  };

  // 스크롤 핸들러
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const width = container.clientWidth;
    if (width > 0) {
      setActivePage(Math.round(scrollLeft / width));
    }
  };

  return (
    <div className="animate-fade-in pb-10">
      {/* 헤더 */}
      <header className="px-6 pt-12 pb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">
              팀 배정
            </h1>
            <div className="h-1 w-8 bg-primary mt-3 rounded-full"></div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              Match #{Math.floor(Math.random() * 100)}
            </p>
            <p className="text-[10px] font-black text-primary uppercase mt-1">
              오늘 {currentTime}
            </p>
          </div>
        </div>
      </header>

      <section className="space-y-6">
        {/* 참석 현황 */}
        <div>
          <div className="flex justify-between items-center mb-4 px-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="material-icons text-primary text-sm">groups</span>
              참석 현황
              <span className="text-xs text-primary/60 ml-1">({attendingCount}명 선택됨)</span>
            </h2>
            <button
              onClick={() => isAllSelected ? clearAllParticipants() : selectAllParticipants()}
              className={`text-xs font-bold px-4 py-1.5 rounded-full border active:scale-95 transition-all ${
                isAllSelected
                  ? 'text-red-500 bg-red-500/10 border-red-500/20'
                  : 'text-primary bg-primary/10 border-primary/20'
              }`}
            >
              {isAllSelected ? '전체 해제' : '전체 선택'}
            </button>
          </div>

          {members.length === 0 ? (
            <div className="px-6">
              <p className="text-center text-white/40 py-8">멤버를 추가해주세요</p>
            </div>
          ) : (
            <div className="relative">
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex overflow-x-auto hide-scrollbar snap-x snap-mandatory touch-pan-x"
              >
                {playerChunks.map((chunk, chunkIdx) => (
                  <div key={chunkIdx} className="w-full flex-shrink-0 snap-center px-6">
                    <div className="grid grid-cols-2 gap-3">
                      {chunk.map(member => {
                        const isSelected = selectedParticipants.includes(member.id);
                        return (
                          <div
                            key={member.id}
                            onClick={() => toggleParticipant(member.id)}
                            className={`glass-card rounded-[1.25rem] p-4 flex items-center justify-between transition-all cursor-pointer border-2 ${
                              isSelected ? 'border-l-primary border-primary/20 opacity-100' : 'border-transparent opacity-40'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-white/10">
                                <span className="text-sm font-bold">{member.name[0]}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-white truncate">{member.name}</p>
                              </div>
                            </div>
                            <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected ? 'bg-primary border-primary' : 'border-white/10'
                            }`}>
                              {isSelected && <span className="material-icons text-[14px] text-background-dark font-black">check</span>}
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
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        activePage === i ? 'w-8 bg-primary neon-glow' : 'w-2 bg-white/10'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 space-y-6">
          {/* 용병 추가 */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="material-icons text-primary text-sm">person_add</span>
                용병 추가
                <span className="text-xs text-primary/60 ml-1">({attendingMercenaryCount}명 선택됨)</span>
              </h2>
            </div>
            <div className="glass-card rounded-2xl p-4 space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mercenaryName}
                  onChange={(e) => setMercenaryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMercenary()}
                  placeholder="용병 이름 입력"
                  className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-all"
                />
                <button
                  onClick={handleAddMercenary}
                  className="bg-primary text-background-dark px-4 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-transform"
                >
                  추가
                </button>
              </div>

              {/* 용병 리스트 */}
              {mercenaries.length > 0 && (
                <div className="space-y-2 pt-2">
                  {sortedMercenaries.map(merc => {
                    const isSelected = selectedMercenaries.includes(merc.id);
                    return (
                      <div
                        key={merc.id}
                        onClick={() => toggleMercenary(merc.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected ? 'bg-primary/5 border-primary/20' : 'bg-black/20 border-white/5 opacity-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'bg-primary border-primary' : 'border-white/10'
                          }`}>
                            {isSelected && <span className="material-icons text-[14px] text-background-dark">check</span>}
                          </div>
                          <span className="text-sm font-bold">{merc.name}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-orange-500/20 text-orange-500 rounded-full font-bold">용병</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveMercenary(merc.id);
                          }}
                          className="material-icons text-sm text-white/30 hover:text-red-500"
                        >
                          close
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 고정 팀 현황 */}
          {fixedTeams.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <span className="material-icons text-primary text-sm">lock</span>
                고정팀 현황
              </h2>
              <div className="space-y-2">
                {fixedTeams.map((team, idx) => {
                  const teamMembers = team.playerIds.map(id =>
                    members.find(m => m.id === id) || mercenaries.find(m => m.id === id)
                  ).filter(Boolean);

                  return (
                    <div key={idx} className="flex items-center justify-between bg-primary/5 border border-primary/20 p-4 rounded-xl group animate-fade-in">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                          LOCKED DUO
                        </span>
                        <span className="text-sm font-bold">
                          {teamMembers.map(m => m?.name).join(' + ')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 통계 카드 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center gap-2 border border-white/5">
              <p className="text-[10px] uppercase tracking-wider opacity-60 font-black">멤버 인원</p>
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm font-bold text-white/80">
                  멤버 <span className="text-primary">{members.length}명</span>
                </p>
                <p className="text-sm font-bold text-white/80">
                  용병 <span className="text-primary">{mercenaries.length}명</span>
                </p>
              </div>
            </div>
            <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center gap-2 border border-white/5">
              <p className="text-[10px] uppercase tracking-wider opacity-60 font-black">참석 인원</p>
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black text-primary">{totalAttending}명</span>
              </div>
            </div>
          </div>

          {/* 팀 나누기 버튼 */}
          <div className="pt-6 pb-4">
            <button
              onClick={() => setShowTeamCountModal(true)}
              disabled={totalAttending < 2}
              className={`w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all shadow-[0_10px_40px_rgba(13,242,62,0.3)] ${
                totalAttending < 2
                  ? 'bg-white/10 text-white/20 cursor-not-allowed'
                  : 'bg-primary text-background-dark neon-glow active:scale-[0.98]'
              }`}
            >
              <span className="material-icons">shuffle</span>
              DIVIDE INTO TEAMS
            </button>
          </div>

          {/* 팀 배정 결과 */}
          {currentTeams && currentTeams.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="material-icons text-primary text-sm">groups</span>
                팀 배정 결과
              </h2>

              <div className="space-y-3">
                {currentTeams.map((team, idx) => {
                  const teamColors = ['#ff6b6b', '#4facfe', '#43e97b', '#fa709a', '#a8edea'];
                  const teamNames = ['A', 'B', 'C', 'D', 'E', 'F'];
                  const color = teamColors[idx % teamColors.length];

                  return (
                    <div
                      key={idx}
                      className="glass-card rounded-2xl p-5 border-2"
                      style={{ borderColor: `${color}40` }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg"
                          style={{ background: color }}
                        >
                          {teamNames[idx]}
                        </div>
                        <div>
                          <h3 className="text-lg font-black" style={{ color }}>{teamNames[idx]}팀</h3>
                          <p className="text-xs text-white/40">{team.length}명</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {team.map((member, i) => (
                          <div key={i} className="flex items-center gap-2 bg-black/20 rounded-lg p-2">
                            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                              {member.name[0]}
                            </div>
                            <span className="text-sm font-medium truncate">{member.name}</span>
                            {member.isMercenary && (
                              <span className="text-[8px] px-1.5 py-0.5 bg-orange-500/20 text-orange-500 rounded-full font-bold ml-auto">용</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 결과 저장 버튼 */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleDivideTeams(currentTeams.length)}
                  className="flex-1 py-3 rounded-xl font-bold bg-white/5 border border-white/10 active:scale-95 transition-all"
                >
                  다시 섞기
                </button>
                <button
                  onClick={() => setShowSavePeriodModal(true)}
                  className="flex-1 py-3 rounded-xl font-bold bg-primary text-background-dark active:scale-95 transition-all"
                >
                  결과 저장
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 팀 개수 선택 모달 */}
      {showTeamCountModal && (
        <div className="modal" style={{ display: 'flex' }} onClick={() => setShowTeamCountModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>팀 개수 선택</h3>
            <div className="grid grid-cols-3 gap-3 my-6">
              {[2, 3, 4, 5, 6].map(count => (
                <button
                  key={count}
                  onClick={() => handleDivideTeams(count)}
                  className="glass-card p-6 rounded-xl font-black text-2xl hover:border-primary/50 transition-all"
                >
                  {count}팀
                </button>
              ))}
            </div>
            <button onClick={() => setShowTeamCountModal(false)} className="cancel-btn">
              취소
            </button>
          </div>
        </div>
      )}

      {/* 저장 모달 */}
      {showSavePeriodModal && (
        <div className="modal" style={{ display: 'flex' }} onClick={() => setShowSavePeriodModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>결과 저장</h3>
            <p className="modal-message">어느 시간대로 저장하시겠습니까?</p>
            <div className="modal-actions" style={{ flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => handleSave('전반전')} className="w-full">전반전</button>
              <button onClick={() => handleSave('후반전')} className="w-full">후반전</button>
              <button onClick={() => setShowSavePeriodModal(false)} className="cancel-btn w-full">취소</button>
            </div>
          </div>
        </div>
      )}

      {/* Alert 모달 */}
      <AlertModal
        isOpen={showAlert}
        message={alertMessage}
        onClose={() => setShowAlert(false)}
      />

      {/* Confirm 모달 */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  );
};

export default DivisionPage;
