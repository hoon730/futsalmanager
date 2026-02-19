import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSquadStore } from '@/stores/squadStore';
import { useDivisionStore } from '@/stores/divisionStore';
import { useAdminStore } from '@/stores/adminStore';
import { AlertModal, ConfirmModal, AdminPasswordModal } from '@/components/modals';

// 출석 통계 데이터 타입
interface AttendanceData {
  name: string;
  attended: number;
  total: number;
  rate: number;
}

// 이력 상세 모달 데이터 타입
interface HistoryDetail {
  notes: string;
  date: string;
  teams: Array<Array<{ id: string; name: string; isMercenary?: boolean }>>;
}

export default function AttendancePage() {
  const { squad } = useSquadStore();
  const members = squad?.members || [];
  const { divisionHistory } = useDivisionStore();
  const { setIsAdmin } = useAdminStore();

  // 삭제 기능은 현재 디자인에 없으므로 미사용
  // const { deleteDivision, clearAllDivisions } = useDivisionStore();
  // const { isAdmin } = useAdminStore();

  // 상태 관리
  const [totalGames, setTotalGames] = useState(0);
  const [overallRate, setOverallRate] = useState(84); // 전체 평균 출석률
  const [topMembers, setTopMembers] = useState<AttendanceData[]>([]);

  // 모달 상태
  const [selectedSession, setSelectedSession] = useState<HistoryDetail | null>(null);
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
  const [adminPasswordModal, setAdminPasswordModal] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<{type: 'single' | 'all', id?: string} | null>(null);

  // 출석 통계 계산
  useEffect(() => {
    calculateAttendanceStats();
  }, [members, divisionHistory]);

  const calculateAttendanceStats = () => {
    // 총 경기 수
    const games = divisionHistory.length;
    setTotalGames(games);

    // 멤버별 출석 통계 계산 (용병 제외)
    const attendanceMap: { [key: string]: AttendanceData } = {};

    members.forEach((member: any) => {
      attendanceMap[member.id] = {
        name: member.name,
        attended: 0,
        total: games,
        rate: 0,
      };
    });

    divisionHistory.forEach((game: any) => {
      const participants = game.teams.flat();
      participants.forEach((player: any) => {
        const playerId = player.id;
        const member = members.find((m: any) => m.id === playerId);

        // 용병이 아닌 정규 멤버만 출석 통계에 포함
        if (member && attendanceMap[member.id] && !player.isMercenary) {
          attendanceMap[member.id].attended++;
        }
      });
    });

    // 출석률 계산
    const attendanceList = Object.values(attendanceMap).map((item) => ({
      ...item,
      rate: games > 0 ? parseFloat(((item.attended / item.total) * 100).toFixed(0)) : 0,
    }));

    // 전체 평균 출석률 계산
    if (attendanceList.length > 0) {
      const avgRate = attendanceList.reduce((sum, item) => sum + item.rate, 0) / attendanceList.length;
      setOverallRate(Math.round(avgRate));
    }

    // TOP 3 설정 (출석률 높은 순)
    const topList = [...attendanceList].sort((a, b) => b.rate - a.rate);
    setTopMembers(topList.slice(0, 3));
  };

  // 날짜 파싱
  const getParsedDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate();
    return { month, day };
  };

  // 이력 상세 보기
  const showHistoryDetail = (detail: any) => {
    setSelectedSession({
      notes: detail.notes || new Date(detail.divisionDate).toLocaleDateString('ko-KR'),
      date: detail.notes || new Date(detail.divisionDate).toLocaleDateString('ko-KR'),
      teams: detail.teams,
    });
  };

  // 관리자 비밀번호 확인
  const handleAdminPasswordSubmit = (password: string) => {
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;

    if (password === adminPassword) {
      setIsAdmin(true);
      setAdminPasswordModal(false);
      setAlertModal({ isOpen: true, message: '✅ 관리자 인증 성공' });

      // 대기 중인 작업 실행
      if (pendingDeleteAction) {
        if (pendingDeleteAction.type === 'all') {
          confirmClearAllHistory();
        } else if (pendingDeleteAction.type === 'single' && pendingDeleteAction.id) {
          confirmDeleteHistory(pendingDeleteAction.id);
        }
        setPendingDeleteAction(null);
      }
    } else {
      setAdminPasswordModal(false);
      setAlertModal({ isOpen: true, message: '❌ 비밀번호가 틀렸습니다' });
      setPendingDeleteAction(null);
    }
  };

  // 관리자 권한 요청 (현재 미사용 - 참조 디자인에 삭제 기능 없음)
  // const requestAdminAccess = (type: 'single' | 'all', id?: string) => {
  //   if (isAdmin) {
  //     if (type === 'all') {
  //       confirmClearAllHistory();
  //     } else if (id) {
  //       confirmDeleteHistory(id);
  //     }
  //   } else {
  //     setPendingDeleteAction({ type, id });
  //     setAdminPasswordModal(true);
  //   }
  // };

  // 전체 이력 삭제 확인 (현재 미사용)
  const confirmClearAllHistory = () => {
    setConfirmModal({
      isOpen: true,
      title: '⚠️ 경고',
      message: '모든 경기 이력을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.',
      onConfirm: async () => {
        // await clearAllDivisions();
        setAlertModal({ isOpen: true, message: '이력이 삭제되었습니다' });
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
    });
  };

  // 이력 삭제 확인 (현재 미사용)
  const confirmDeleteHistory = (_id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '이력 삭제',
      message: '이 기록을 삭제하시겠습니까?',
      onConfirm: async () => {
        // await deleteDivision(_id);
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
    });
  };

  // 최근 3개 이력
  const recentSessions = [...divisionHistory].reverse().slice(0, 3);

  return (
    <div className="animate-fade-in">
      {/* 헤더 */}
      <header className="px-6 pt-12 pb-10">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">
            기록 및 순위
          </h1>
          <div className="h-1 w-8 bg-primary mt-3 rounded-full shadow-[0_0_10px_#0df23e]"></div>
        </div>
      </header>

      <div className="px-6">
        {/* 출석률 원형 차트 */}
        <section className="mb-15 flex flex-col items-center">
          <div className="relative w-44 h-44 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r="40%"
                stroke="rgba(13, 242, 62, 0.05)"
                strokeWidth="15"
                fill="none"
              />
              <circle
                cx="50%"
                cy="50%"
                r="40%"
                stroke="#0df23e"
                strokeWidth="15"
                fill="none"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 * (1 - overallRate / 100)}
                strokeLinecap="round"
                className="neon-glow"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-4xl font-black italic">
                {overallRate}
                <span className="text-primary text-xl">%</span>
              </span>
              <span className="text-[9px] text-white/40 uppercase tracking-[0.2em] mt-2 font-bold">
                참석률
              </span>
            </div>
          </div>
        </section>

        {/* TOP 출석률 */}
        <section className="mb-15">
          <h2 className="text-lg font-black mb-8 flex items-center gap-2 italic uppercase">
            <span className="material-icons text-primary">emoji_events</span>
            TOP 출석률
          </h2>
          {topMembers.length === 0 || totalGames === 0 ? (
            <div className="py-12 text-center">
              <span className="material-icons text-white/10 text-5xl">group_off</span>
              <p className="text-xs text-white/20 mt-4">아직 경기 기록이 없습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 items-end">
              {/* 2위 */}
              {topMembers[1] && (
                <div className="flex flex-col items-center opacity-60">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border-2 border-white/10 mb-2">
                    <span className="text-lg font-bold">{topMembers[1].name[0]}</span>
                  </div>
                  <span className="text-[10px] font-bold truncate w-full text-center">{topMembers[1].name}</span>
                  <span className="text-[10px] font-black mt-0.5" style={{ color: '#0DF23E' }}>{topMembers[1].rate}%</span>
                </div>
              )}

              {/* 1위 */}
              {topMembers[0] && (
                <div className="flex flex-col items-center">
                  <div className="relative mb-2">
                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center border-[3px] border-primary relative z-10 shadow-[0_0_20px_rgba(13,242,62,0.3)]">
                      <span className="text-2xl font-bold">{topMembers[0].name[0]}</span>
                    </div>
                    <span className="material-icons absolute -top-4 left-1/2 -translate-x-1/2 z-20 text-yellow-400 text-3xl">
                      military_tech
                    </span>
                  </div>
                  <span className="text-xs font-black italic truncate w-full text-center">{topMembers[0].name}</span>
                  <span className="text-[11px] font-black mt-0.5" style={{ color: '#0DF23E' }}>{topMembers[0].rate}%</span>
                </div>
              )}

              {/* 3위 */}
              {topMembers[2] && (
                <div className="flex flex-col items-center opacity-60">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border-2 border-white/10 mb-2">
                    <span className="text-lg font-bold">{topMembers[2].name[0]}</span>
                  </div>
                  <span className="text-[10px] font-bold truncate w-full text-center">{topMembers[2].name}</span>
                  <span className="text-[10px] font-black mt-0.5" style={{ color: '#0DF23E' }}>{topMembers[2].rate}%</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 최근 기록 */}
        <section className="mb-15">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black italic uppercase flex items-center gap-2">
              <span className="material-icons text-primary">history</span>
              최근 기록
            </h2>
          </div>
          {recentSessions.length === 0 ? (
            <div className="py-12 text-center">
              <span className="material-icons text-white/10 text-5xl">event_busy</span>
              <p className="text-xs text-white/20 mt-4">저장된 기록이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSessions.map((session, idx) => {
                const { month, day } = getParsedDate(session.divisionDate);
                const participantCount = session.teams.flat().filter((p: any) => !p.isMercenary).length;

                return (
                  <div
                    key={session.id}
                    className="glass-card p-4 rounded-3xl flex items-center gap-4 border border-white/5"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-black text-white/40">{month}</span>
                      <span className="text-xl font-black text-primary">{day}</span>
                    </div>
                    <div className="flex-grow min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">
                        {session.notes || `Match #${divisionHistory.length - idx}`}
                      </h4>
                      <div className="flex items-center gap-1 text-[11px] text-white/40 mt-1">
                        <span className="material-icons text-[14px]">person</span>
                        <span>{participantCount}명</span>
                      </div>
                    </div>
                    <button
                      onClick={() => showHistoryDetail(session)}
                      className="px-4 py-2 rounded-full bg-primary text-background-dark text-[10px] font-black"
                    >
                      상세보기
                    </button>
                  </div>
                );
              })}
            </div>
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
            style={{
              background: 'rgba(22,38,27,0.95)',
              backdropFilter: 'blur(20px)',
              border: '2px solid rgba(13,242,62,0.3)',
              boxShadow: '0 0 60px rgba(13,242,62,0.15)',
              maxHeight: '85vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mb-6 flex-shrink-0">
              <h2 className="text-xl font-black italic uppercase text-white leading-tight">
                {selectedSession.notes}
              </h2>
              <p className="text-[10px] text-primary font-bold uppercase tracking-[0.2em] mt-1">
                {selectedSession.date}
              </p>
            </header>

            <main className="flex-1 overflow-y-auto hide-scrollbar space-y-8 min-h-0">
              {selectedSession.teams.map((team, i) => {
                const teamColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
                const color = teamColors[i % teamColors.length];
                return (
                  <div key={i} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-4 rounded-full" style={{ backgroundColor: color }}></div>
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                        TEAM {i + 1}
                      </h3>
                    </div>
                    <div className="grid gap-2">
                      {team.map((player, j) => (
                        <div key={j} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white"
                            style={{ backgroundColor: color }}
                          >
                            {player.name.slice(1)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-white">{player.name}</p>
                            {player.isMercenary && (
                              <p className="text-[10px] text-orange-400 font-bold uppercase">GUEST</p>
                            )}
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
            </footer>
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
        onClose={() => {
          setAdminPasswordModal(false);
          setPendingDeleteAction(null);
        }}
      />
    </div>
  );
}
