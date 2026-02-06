import { useEffect, useState } from 'react';
import { useSquadStore } from '@/stores/squadStore';
import { useDivisionStore } from '@/stores/divisionStore';
import { AlertModal } from '@/components/modals/AlertModal';
import { ConfirmModal } from '@/components/modals/ConfirmModal';

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
  teams: Array<Array<{ id: string; name: string }>>;
}

export default function AttendancePage() {
  const { squad } = useSquadStore();
  const members = squad?.members || [];
  const { divisionHistory, deleteDivision } = useDivisionStore();

  // 상태 관리
  const [totalGames, setTotalGames] = useState(0);
  const [avgParticipants, setAvgParticipants] = useState(0);
  const [topMembers, setTopMembers] = useState<AttendanceData[]>([]);
  const [allMembersAttendance, setAllMembersAttendance] = useState<AttendanceData[]>([]);

  // 페이지네이션 상태
  const [currentHistoryPage, setCurrentHistoryPage] = useState(1);
  const [currentAttendancePage, setCurrentAttendancePage] = useState(1);
  const itemsPerHistoryPage = 3;
  const itemsPerAttendancePage = 5;

  // 모달 상태
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
  const [historyDetailModal, setHistoryDetailModal] = useState<{
    isOpen: boolean;
    detail: HistoryDetail | null;
  }>({
    isOpen: false,
    detail: null,
  });

  // 출석 통계 계산
  useEffect(() => {
    calculateAttendanceStats();
  }, [members, divisionHistory]);

  const calculateAttendanceStats = () => {
    // 총 경기 수
    const games = divisionHistory.length;
    setTotalGames(games);

    // 평균 참가 인원
    if (games > 0) {
      const totalParticipants = divisionHistory.reduce((sum: any, game: any) => {
        const gameParticipants = game.teams.flat();
        return sum + gameParticipants.length;
      }, 0);
      const avg = totalParticipants / games;
      setAvgParticipants(parseFloat(avg.toFixed(1)));
    } else {
      setAvgParticipants(0);
    }

    // 멤버별 출석 통계 계산
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

        if (member && attendanceMap[member.id]) {
          attendanceMap[member.id].attended++;
        }
      });
    });

    // 출석률 계산 및 정렬
    const attendanceList = Object.values(attendanceMap)
      .map((item) => ({
        ...item,
        rate: games > 0 ? parseFloat(((item.attended / item.total) * 100).toFixed(0)) : 0,
      }))
      .sort((a, b) => b.attended - a.attended);

    // TOP 3 설정
    setTopMembers(attendanceList.slice(0, 3));

    // 전체 출석률 설정
    setAllMembersAttendance(attendanceList);
  };

  // 이력 상세 보기
  const showHistoryDetail = (index: number) => {
    const reversedHistory = [...divisionHistory].reverse();
    const detail = reversedHistory[index];

    if (!detail) return;

    setHistoryDetailModal({
      isOpen: true,
      detail: {
        notes: detail.notes || new Date(detail.divisionDate).toLocaleDateString('ko-KR'),
        date: detail.notes || new Date(detail.divisionDate).toLocaleDateString('ko-KR'),
        teams: detail.teams,
      },
    });
  };

  // 이력 삭제 확인
  const confirmDeleteHistory = (index: number) => {
    setConfirmModal({
      isOpen: true,
      title: '이력 삭제',
      message: '이 기록을 삭제하시겠습니까?',
      onConfirm: () => {
        const reversedIndex = divisionHistory.length - 1 - index;
        deleteDivision(divisionHistory[reversedIndex].id);
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
    });
  };

  // 페이지네이션된 이력 목록
  const paginatedHistory = () => {
    const reversedHistory = [...divisionHistory].reverse();
    const startIdx = (currentHistoryPage - 1) * itemsPerHistoryPage;
    const endIdx = startIdx + itemsPerHistoryPage;
    return reversedHistory.slice(startIdx, endIdx);
  };

  const totalHistoryPages = Math.ceil(divisionHistory.length / itemsPerHistoryPage);

  // 페이지네이션된 출석률 목록
  const paginatedAttendance = () => {
    const startIdx = (currentAttendancePage - 1) * itemsPerAttendancePage;
    const endIdx = startIdx + itemsPerAttendancePage;
    return allMembersAttendance.slice(startIdx, endIdx);
  };

  const totalAttendancePages = Math.ceil(allMembersAttendance.length / itemsPerAttendancePage);

  return (
    <div style={{ paddingBottom: 'calc(75px + env(safe-area-inset-bottom))' }}>
      {/* 출석 통계 섹션 */}
      <section className="section">
        <h2>📊 출석 통계</h2>
        <div className="stats-summary">
          <div className="stat-item">
            <span className="stat-label">총 경기</span>
            <span className="stat-value">{totalGames}회</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">평균 참가</span>
            <span className="stat-value">{avgParticipants}명</span>
          </div>
        </div>
      </section>

      {/* 단골 멤버 TOP 3 섹션 */}
      <section className="section">
        <h2>🏆 단골 멤버 TOP 3</h2>
        <div className="top-members">
          {topMembers.length === 0 || totalGames === 0 ? (
            <p className="empty-message">아직 경기 기록이 없습니다</p>
          ) : (
            topMembers.map((member, index) => {
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div key={index} className="top-member-item">
                  <span className="member-rank">{medals[index]}</span>
                  <div className="member-info">
                    <div className="member-name-container">
                      <span className="member-name">{member.name}</span>
                      <span style={{ color: '#999', fontSize: '0.9em' }}>
                        {member.attended}/{member.total}회
                      </span>
                    </div>
                    <div className="member-stats">
                      <div className="attendance-bar">
                        <div
                          className="attendance-fill"
                          style={{ width: `${member.rate}%` }}
                        ></div>
                      </div>
                      <span className="attendance-rate">{member.rate}%</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 전체 멤버 출석률 섹션 */}
      <section className="section">
        <h2>📋 전체 멤버 출석률</h2>
        <div className="all-attendance">
          {allMembersAttendance.length === 0 || totalGames === 0 ? (
            <p className="empty-message">아직 경기 기록이 없습니다</p>
          ) : (
            <>
              {paginatedAttendance().map((member, index) => (
                <div key={index} className="attendance-item">
                  <span className="attendance-name">{member.name}</span>
                  <span className="attendance-count">
                    {member.attended}/{member.total}회 ({member.rate}%)
                  </span>
                </div>
              ))}
              {totalAttendancePages > 1 && (
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    disabled={currentAttendancePage === 1}
                    onClick={() => setCurrentAttendancePage(currentAttendancePage - 1)}
                  >
                    ◀
                  </button>
                  <span className="pagination-info">
                    {currentAttendancePage} / {totalAttendancePages}
                  </span>
                  <button
                    className="pagination-btn"
                    disabled={currentAttendancePage === totalAttendancePages}
                    onClick={() => setCurrentAttendancePage(currentAttendancePage + 1)}
                  >
                    ▶
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* 전체 이력 섹션 */}
      <section className="section">
        <h2>📜 전체 이력</h2>
        <div className="history-list">
          {divisionHistory.length === 0 ? (
            <p className="empty-message">저장된 기록이 없습니다</p>
          ) : (
            <>
              {paginatedHistory().map((item, index) => {
                const reversedIndex =
                  (currentHistoryPage - 1) * itemsPerHistoryPage + index;
                const displayDate =
                  item.notes || new Date(item.divisionDate).toLocaleDateString('ko-KR');
                return (
                  <div
                    key={index}
                    className="history-item"
                    onClick={() => showHistoryDetail(reversedIndex)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="history-header">
                      <span className="history-date">{displayDate}</span>
                      <button
                        className="delete-history-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDeleteHistory(reversedIndex);
                        }}
                      >
                        삭제
                      </button>
                    </div>
                    <div className="history-teams-preview">
                      {item.teams.map((team, i) => (
                        <span key={i} className="team-badge">
                          {String.fromCharCode(65 + i)}팀 ({team.length}명)
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
              {totalHistoryPages > 1 && (
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    disabled={currentHistoryPage === 1}
                    onClick={() => setCurrentHistoryPage(currentHistoryPage - 1)}
                  >
                    ◀
                  </button>
                  <span className="pagination-info">
                    {currentHistoryPage} / {totalHistoryPages}
                  </span>
                  <button
                    className="pagination-btn"
                    disabled={currentHistoryPage === totalHistoryPages}
                    onClick={() => setCurrentHistoryPage(currentHistoryPage + 1)}
                  >
                    ▶
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* 이력 상세 보기 모달 */}
      {historyDetailModal.isOpen && historyDetailModal.detail && (
        <div
          className="modal"
          style={{ display: 'flex' }}
          onClick={() => setHistoryDetailModal({ isOpen: false, detail: null })}
        >
          <div
            className="modal-content history-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>팀 배정 상세</h3>
            <p className="modal-date">{historyDetailModal.detail.date}</p>
            <div className="history-detail-teams">
              {historyDetailModal.detail.teams.map((team, i) => {
                const teamNames = ['A', 'B', 'C', 'D', 'E', 'F'];
                const teamEmojis = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠'];
                return (
                  <div key={i} className={`history-detail-team team-${i}`}>
                    <h4>
                      {teamEmojis[i]} {teamNames[i]}팀
                    </h4>
                    <ul>
                      {team.map((player, j) => (
                        <li key={j}>{player.name}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <button
              className="cancel-btn"
              onClick={() => setHistoryDetailModal({ isOpen: false, detail: null })}
            >
              닫기
            </button>
          </div>
        </div>
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
    </div>
  );
}
