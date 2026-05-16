import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSquadStore } from '@/stores/squadStore';
import { useDivisionStore } from '@/stores/divisionStore';
import { useMatchStore } from '@/stores/matchStore';
import { ConfirmModal } from '@/components/modals';

interface HistoryDetail {
  notes: string;
  date: string;
  teams: Array<Array<{ id: string; name: string; isMercenary?: boolean }>>;
}

export default function AttendancePage() {
  const { squad } = useSquadStore();
  const members = useMemo(() => (squad?.members || []).filter((m) => !m.isMercenary), [squad]);
  const { divisionHistory, deleteDivision } = useDivisionStore();
  const { matches, attendees, loadMatches, loadAttendees } = useMatchStore();

  const [showAllHistory, setShowAllHistory] = useState(false);
  const [selectedSession, setSelectedSession] = useState<HistoryDetail | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
    isOpen: false, title: '', message: '', onConfirm: () => {},
  });

  // 경기 일정 데이터 로드
  useEffect(() => {
    if (!squad?.id) return;
    if (matches.length === 0) loadMatches(squad.id);
  }, [squad?.id]);

  useEffect(() => {
    matches.forEach((m) => { if (!attendees[m.id]) loadAttendees(m.id); });
  }, [matches.length]);

  // 경기 RSVP 기반 출석 통계
  const matchStats = useMemo(() => {
    const totalMatches = matches.length;
    if (totalMatches === 0 || members.length === 0) return { totalMatches, memberStats: [], overallRate: 0 };

    const statMap: Record<string, { name: string; attended: number }> = {};
    members.forEach((m) => { statMap[m.id] = { name: m.name, attended: 0 }; });

    matches.forEach((match) => {
      const matchAttendees = attendees[match.id] || [];
      matchAttendees.forEach((a) => {
        if (a.status === 'attending' && a.memberId && statMap[a.memberId]) {
          statMap[a.memberId].attended++;
        }
      });
    });

    const memberStats = Object.entries(statMap).map(([id, s]) => ({
      id,
      name: s.name,
      attended: s.attended,
      total: totalMatches,
      rate: totalMatches > 0 ? Math.round((s.attended / totalMatches) * 100) : 0,
    })).sort((a, b) => b.rate - a.rate);

    const overallRate = memberStats.length > 0
      ? Math.round(memberStats.reduce((sum, s) => sum + s.rate, 0) / memberStats.length)
      : 0;

    return { totalMatches, memberStats, overallRate };
  }, [matches, attendees, members]);

  const displayedHistory = showAllHistory ? [...divisionHistory].reverse() : [...divisionHistory].reverse().slice(0, 3);

  const getParsedDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: d.getDate(),
    };
  };

  const showHistoryDetail = (detail: { notes?: string; divisionDate: string; teams: HistoryDetail['teams'] }) => {
    setSelectedSession({
      notes: detail.notes || new Date(detail.divisionDate).toLocaleDateString('ko-KR'),
      date: detail.notes || new Date(detail.divisionDate).toLocaleDateString('ko-KR'),
      teams: detail.teams,
    });
  };

  const confirmDeleteHistory = (id: string) => {
    setConfirmModal({
      isOpen: true, title: '기록 삭제', message: '이 기록을 삭제하시겠습니까?\n삭제된 기록은 복구할 수 없습니다.',
      onConfirm: async () => {
        await deleteDivision(id);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const top3 = matchStats.memberStats.slice(0, 3);

  return (
    <div className="animate-fade-in">
      {/* 헤더 */}
      <header className="px-6 pt-12 pb-10">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">기록 및 순위</h1>
          <div className="h-1 w-8 bg-primary mt-3 rounded-full shadow-[0_0_10px_#0df23e]" />
        </div>
      </header>

      <div className="px-6 space-y-10">

        {/* 경기 참석률 원형 차트 */}
        <section className="flex flex-col items-center">
          <div className="relative w-44 h-44 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 176 176">
              <circle cx="88" cy="88" r="68" stroke="rgba(13,242,62,0.05)" strokeWidth="15" fill="none" />
              <circle
                cx="88" cy="88" r="68" stroke="#0df23e" strokeWidth="15" fill="none"
                strokeDasharray="427.3"
                strokeDashoffset={427.3 * (1 - matchStats.overallRate / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-4xl font-black italic">
                {matchStats.overallRate}<span className="text-primary text-xl">%</span>
              </span>
              <span className="text-[9px] text-white/40 uppercase tracking-[0.2em] mt-2 font-bold">평균 참석률</span>
            </div>
          </div>
          <p className="text-[10px] text-white/20 mt-2 uppercase tracking-widest">
            총 {matchStats.totalMatches}경기 기준
          </p>
        </section>

        {/* TOP 3 출석률 */}
        <section>
          <h2 className="text-lg font-black mb-6 flex items-center gap-2 italic uppercase">
            <span className="material-icons text-primary">emoji_events</span>TOP 출석률
          </h2>
          {top3.length === 0 || matchStats.totalMatches === 0 ? (
            <div className="py-12 text-center">
              <span className="material-icons text-white/10 text-5xl">group_off</span>
              <p className="text-xs text-white/20 mt-4">아직 경기 기록이 없습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 items-end">
              {top3[1] && (
                <div className="flex flex-col items-center opacity-60">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border-2 border-white/10 mb-2">
                    <span className="text-lg font-bold">{top3[1].name[0]}</span>
                  </div>
                  <span className="text-[10px] font-bold truncate w-full text-center">{top3[1].name}</span>
                  <span className="text-[10px] font-black mt-0.5 text-primary">{top3[1].rate}%</span>
                  <span className="text-[9px] text-white/20">{top3[1].attended}/{top3[1].total}</span>
                </div>
              )}
              {top3[0] && (
                <div className="flex flex-col items-center">
                  <div className="relative mb-2">
                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center border-[3px] border-primary shadow-[0_0_20px_rgba(13,242,62,0.3)]">
                      <span className="text-2xl font-bold">{top3[0].name[0]}</span>
                    </div>
                    <span className="material-icons absolute -top-4 left-1/2 -translate-x-1/2 text-yellow-400 text-3xl">military_tech</span>
                  </div>
                  <span className="text-xs font-black italic truncate w-full text-center">{top3[0].name}</span>
                  <span className="text-[11px] font-black mt-0.5 text-primary">{top3[0].rate}%</span>
                  <span className="text-[9px] text-white/20">{top3[0].attended}/{top3[0].total}</span>
                </div>
              )}
              {top3[2] && (
                <div className="flex flex-col items-center opacity-60">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border-2 border-white/10 mb-2">
                    <span className="text-lg font-bold">{top3[2].name[0]}</span>
                  </div>
                  <span className="text-[10px] font-bold truncate w-full text-center">{top3[2].name}</span>
                  <span className="text-[10px] font-black mt-0.5 text-primary">{top3[2].rate}%</span>
                  <span className="text-[9px] text-white/20">{top3[2].attended}/{top3[2].total}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 전체 멤버 출석률 */}
        {matchStats.memberStats.length > 0 && matchStats.totalMatches > 0 && (
          <section>
            <h2 className="text-lg font-black mb-4 flex items-center gap-2 italic uppercase">
              <span className="material-icons text-primary">bar_chart</span>전체 현황
            </h2>
            <div className="space-y-2">
              {matchStats.memberStats.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 py-2">
                  <span className="text-[10px] font-black text-white/20 w-4 text-right">{i + 1}</span>
                  <span className="text-sm font-bold text-white flex-1 min-w-0 truncate">{s.name}</span>
                  <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${s.rate}%`, backgroundColor: s.rate >= 80 ? "#0DF23E" : s.rate >= 50 ? "#f59e0b" : "#ef4444" }}
                    />
                  </div>
                  <span className="text-xs font-black text-white/40 w-10 text-right">{s.rate}%</span>
                  <span className="text-[10px] text-white/20 w-8 text-right">{s.attended}/{s.total}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 팀 배정 이력 */}
        <section className="pb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-black italic uppercase flex items-center gap-2">
              <span className="material-icons text-primary">history</span>팀 배정 이력
            </h2>
            {divisionHistory.length > 0 && (
              <button
                onClick={() => setIsEditMode((v) => !v)}
                className="text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all"
                style={{
                  color: isEditMode ? '#0DF23E' : 'rgba(255,255,255,0.4)',
                  border: `1px solid ${isEditMode ? 'rgba(13,242,62,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  background: isEditMode ? 'rgba(13,242,62,0.05)' : 'transparent',
                }}
              >
                {isEditMode ? '완료' : '편집'}
              </button>
            )}
          </div>
          {divisionHistory.length === 0 ? (
            <div className="py-12 text-center">
              <span className="material-icons text-white/10 text-5xl">event_busy</span>
              <p className="text-xs text-white/20 mt-4">저장된 기록이 없습니다</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {displayedHistory.map((session, idx) => {
                  const { month, day } = getParsedDate(session.divisionDate);
                  const count = session.teams.flat().filter((p: { isMercenary?: boolean }) => !p.isMercenary).length;
                  return (
                    <div key={session.id} className="glass-card p-4 rounded-3xl flex items-center gap-4 border border-white/5">
                      <div className="w-14 h-14 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-black text-white/40">{month}</span>
                        <span className="text-xl font-black text-primary">{day}</span>
                      </div>
                      <div className="flex-grow min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">
                          {session.notes || `Match #${divisionHistory.length - idx}`}
                        </h4>
                        <div className="flex items-center gap-1 text-[11px] text-white/40 mt-1">
                          <span className="material-icons text-[14px]">person</span>
                          <span>{count}명</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={() => showHistoryDetail(session)}
                          className="px-4 py-2 rounded-full bg-primary text-background-dark text-[10px] font-black"
                        >
                          상세보기
                        </button>
                        {isEditMode && (
                          <button
                            onClick={() => confirmDeleteHistory(session.id)}
                            className="px-4 py-2 rounded-full text-[10px] font-black transition-all"
                            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {divisionHistory.length > 3 && (
                <button
                  onClick={() => setShowAllHistory((v) => !v)}
                  className="w-full mt-4 py-3 text-xs font-black uppercase tracking-widest text-white/30 hover:text-white/50 flex items-center justify-center gap-1 transition-colors"
                >
                  <span className="material-icons text-sm">{showAllHistory ? "expand_less" : "expand_more"}</span>
                  {showAllHistory ? "접기" : `전체 ${divisionHistory.length}건 보기`}
                </button>
              )}
            </>
          )}
        </section>
      </div>

      {/* 이력 상세 모달 */}
      {selectedSession && createPortal(
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center px-6 animate-fade-in"
          style={{ zIndex: 9999 }}
          onClick={() => setSelectedSession(null)}
        >
          <div
            className="w-full max-w-sm rounded-[2.5rem] p-8 relative flex flex-col overflow-hidden"
            style={{ background: 'rgba(22,38,27,0.95)', backdropFilter: 'blur(20px)', border: '2px solid rgba(13,242,62,0.3)', boxShadow: '0 0 60px rgba(13,242,62,0.15)', maxHeight: '85vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mb-6 flex-shrink-0">
              <h2 className="text-xl font-black italic uppercase text-white leading-tight">{selectedSession.notes}</h2>
              <p className="text-[10px] text-primary font-bold uppercase tracking-[0.2em] mt-1">{selectedSession.date}</p>
            </header>
            <main className="flex-1 overflow-y-auto hide-scrollbar space-y-8 min-h-0">
              {selectedSession.teams.map((team, i) => {
                const teamColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
                const color = teamColors[i % teamColors.length];
                return (
                  <div key={i} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-4 rounded-full" style={{ backgroundColor: color }} />
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/60">TEAM {i + 1}</h3>
                    </div>
                    <div className="grid gap-2">
                      {team.map((player, j) => (
                        <div key={j} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ backgroundColor: color }}>
                            {player.name.slice(0, 1)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-white">{player.name}</p>
                            {player.isMercenary && <p className="text-[10px] text-orange-400 font-bold uppercase">GUEST</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </main>
            <footer className="mt-6 flex-shrink-0">
              <button
                onClick={() => setSelectedSession(null)}
                className="w-full py-3.5 rounded-xl text-sm font-black uppercase tracking-[0.2em] transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
              >
                닫기
              </button>
            </footer>
          </div>
        </div>,
        document.body
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
