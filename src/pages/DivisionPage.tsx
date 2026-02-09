import { useState, useRef, useMemo } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCards } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
// @ts-expect-error - CSS import
import "swiper/css";
// @ts-expect-error - CSS import
import "swiper/css/effect-cards";

import { useSquadStore } from "@/stores/squadStore";
import { useFixedTeamStore } from "@/stores/fixedTeamStore";
import { useDivisionStore } from "@/stores/divisionStore";
import { divideTeamsWithConstraints, updateTeammateHistory as updateHistory } from "@/lib/teamAlgorithm";
import { AlertModal, ConfirmModal } from "@/components/modals";
import type { IMember } from "@/types";

// 한글/영문 정렬 함수
const sortByName = (a: IMember, b: IMember) => {
  return a.name.localeCompare(b.name, ['ko', 'en']);
};

const DivisionPage = () => {
  const { squad, selectedParticipants, toggleParticipant, selectAllParticipants, clearAllParticipants } = useSquadStore();
  const { fixedTeams } = useFixedTeamStore();
  const { saveDivision, teammateHistory, updateTeammateHistory: updateStoreHistory } = useDivisionStore();

  const [currentTeams, setCurrentTeams] = useState<IMember[][] | null>(null);
  const [_teamCount, __setTeamCount] = useState(2);
  const [currentParticipantPage, setCurrentParticipantPage] = useState(1);
  const participantSwiperRef = useRef<SwiperType | null>(null);

  // 모달 상태
  const [showTeamCountModal, setShowTeamCountModal] = useState(false);
  const [showSavePeriodModal, setShowSavePeriodModal] = useState(false);
  const [showSelectAllModal, setShowSelectAllModal] = useState(false);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [showAlert, setShowAlert] = useState(false);

  const selectedCount = selectedParticipants.length;

  // 정렬된 멤버 리스트
  const sortedMembers = useMemo(() => {
    if (!squad || !squad.members) return [];
    return [...squad.members].sort(sortByName);
  }, [squad]);

  // 페이지네이션 설정
  const itemsPerPage = 5;
  const totalPages = Math.ceil(sortedMembers.length / itemsPerPage);

  const paginatedMembers = useMemo(() => {
    const result: IMember[][] = [];
    for (let i = 0; i < sortedMembers.length; i += itemsPerPage) {
      result.push(sortedMembers.slice(i, i + itemsPerPage));
    }
    return result;
  }, [sortedMembers]);

  // 스와이프 핸들러
  const handleSwipe = (swiper: SwiperType) => {
    setCurrentParticipantPage(swiper.activeIndex + 1);
  };

  const handleSelectAll = () => {
    if (!squad || squad.members.length === 0) {
      setAlertMessage("등록된 멤버가 없습니다");
      setShowAlert(true);
      return;
    }
    setShowSelectAllModal(true);
  };

  const confirmSelectAll = () => {
    selectAllParticipants();
    setShowSelectAllModal(false);
  };

  const handleClearAll = () => {
    if (selectedParticipants.length === 0) {
      setAlertMessage("선택된 참가자가 없습니다");
      setShowAlert(true);
      return;
    }
    setShowClearAllModal(true);
  };

  const confirmClearAll = () => {
    clearAllParticipants();
    setShowClearAllModal(false);
  };

  const handleDivideTeams = () => {
    if (selectedParticipants.length < 2) {
      setAlertMessage("최소 2명 이상 선택해주세요");
      setShowAlert(true);
      return;
    }
    setShowTeamCountModal(true);
  };

  const selectTeamCountAndDivide = async (count: number) => {

    setShowTeamCountModal(false);

    const activePlayers: IMember[] = selectedParticipants
      .map((id) => squad?.members.find((m) => m.id === id))
      .filter((m): m is IMember => m !== undefined);

    if (activePlayers.length < count) {
      setAlertMessage(`${count}팀으로 나누려면 최소 ${count}명이 필요합니다`);
      setShowAlert(true);
      return;
    }

    const result = await divideTeamsWithConstraints(
      activePlayers,
      count,
      fixedTeams,
      teammateHistory
    );

    if (!result) {
      setAlertMessage("팀을 나눌 수 없습니다. 고정 팀 설정을 확인해주세요.");
      setShowAlert(true);
      return;
    }

    setCurrentTeams(result.teams);
  };

  const handleSave = () => {
    if (!currentTeams) return;
    setShowSavePeriodModal(true);
  };

  const saveWithPeriod = (period: "전반전" | "후반전") => {
    if (!currentTeams || !squad) return;

    const date = new Date();
    const notes = `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. ${period}`;

    saveDivision({
      id: Date.now().toString(),
      squadId: squad.id,
      divisionDate: date.toISOString(),
      notes,
      period,
      teams: currentTeams,
      teamCount: currentTeams.length,
    });

    updateStoreHistory(updateHistory(currentTeams, teammateHistory));

    setSaveSuccessMessage(`${period} 결과가 저장되었습니다`);
    setShowSavePeriodModal(false);
    setShowSaveSuccessModal(true);
  };

  const teamColors = ["team-0", "team-1", "team-2", "team-3", "team-4"];
  const teamNames = ["A팀", "B팀", "C팀", "D팀", "E팀"];

  return (
    <>
      {/* 오늘 참가자 선택 */}
      <section className="section">
        <h2>✅ 오늘 참가자</h2>
        <div className="participant-select-info">
          <span id="selectedCount">{selectedCount}명 선택됨</span>
          <div className="quick-actions">
            <button className="btn-small" onClick={handleSelectAll}>
              전체선택
            </button>
            <button className="btn-small" onClick={handleClearAll}>
              전체해제
            </button>
          </div>
        </div>

        {!squad || squad.members.length === 0 ? (
          <div className="participant-checkboxes">
            <p className="empty-message">설정 탭에서 스쿼드 멤버를 먼저 추가해주세요</p>
          </div>
        ) : totalPages === 1 ? (
          <div className="participant-checkboxes">
            {sortedMembers.map((member) => (
              <div key={member.id} className="checkbox-item">
                <input
                  type="checkbox"
                  id={`participant-${member.id}`}
                  checked={selectedParticipants.includes(member.id)}
                  onChange={() => toggleParticipant(member.id)}
                />
                <label htmlFor={`participant-${member.id}`}>{member.name}</label>
              </div>
            ))}
          </div>
        ) : (
          <>
            <Swiper
              slidesPerView={1}
              onSwiper={(swiper) => { participantSwiperRef.current = swiper; }}
              onSlideChange={handleSwipe}
              allowTouchMove={true}
              className="participant-swiper"
            >
              {paginatedMembers.map((pageMembers, pageIndex) => (
                <SwiperSlide key={pageIndex}>
                  <div className="participant-checkboxes">
                    {pageMembers.map((member) => (
                      <div key={member.id} className="checkbox-item">
                        <input
                          type="checkbox"
                          id={`participant-${member.id}`}
                          checked={selectedParticipants.includes(member.id)}
                          onChange={() => toggleParticipant(member.id)}
                        />
                        <label htmlFor={`participant-${member.id}`}>{member.name}</label>
                      </div>
                    ))}
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  disabled={currentParticipantPage === 1}
                  onClick={() => participantSwiperRef.current?.slidePrev()}
                >
                  ◀
                </button>
                <span className="pagination-info">
                  {currentParticipantPage} / {totalPages}
                </span>
                <button
                  className="pagination-btn"
                  disabled={currentParticipantPage === totalPages}
                  onClick={() => participantSwiperRef.current?.slideNext()}
                >
                  ▶
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* 팀 나누기 / 결과 표시 */}
      <section className="section team-division-section">
        {!currentTeams ? (
          <div className="division-state">
            <h2>🎲 팀 나누기</h2>
            <button className="divide-btn" onClick={handleDivideTeams}>
              🎲 팀 나누기
            </button>
          </div>
        ) : (
          <div className="division-state">
            <h2>📋 팀 배정 결과</h2>
            <Swiper
              effect="cards"
              grabCursor={true}
              modules={[EffectCards]}
              className="mySwiper"
            >
              {currentTeams.map((team, index) => (
                <SwiperSlide key={index}>
                  <div className={`team-card ${teamColors[index]}`}>
                    <div className="team-card-header">
                      <span className="team-emoji">⚽</span>
                      <h3>{teamNames[index]}</h3>
                      <span className="team-count">{team.length}명</span>
                    </div>
                    <div className="team-card-body">
                      <ul className="team-members">
                        {team.map((member) => (
                          <li key={member.id}>{member.name}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
            <div className="result-actions">
              <button className="save-btn" onClick={handleSave}>
                💾 결과 저장
              </button>
              <button className="reshuffle-btn" onClick={handleDivideTeams}>
                🔄 다시 섞기
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 팀 개수 선택 모달 */}
      {showTeamCountModal && (
        <div className="modal">
          <div className="modal-content team-count-modal">
            <h3>팀 개수 선택</h3>
            <p className="modal-subtitle">몇 개 팀으로 나눌까요?</p>
            <div className="team-count-grid">
              {[2, 3, 4, 5].map((count) => (
                <button
                  key={count}
                  className="team-count-btn"
                  onClick={() => selectTeamCountAndDivide(count)}
                >
                  <span className="team-emoji">⚽</span>
                  <span className="team-label">{count}팀</span>
                </button>
              ))}
            </div>
            <button className="cancel-btn" onClick={() => setShowTeamCountModal(false)}>
              취소
            </button>
          </div>
        </div>
      )}

      {/* 저장 시간대 선택 모달 */}
      {showSavePeriodModal && (
        <div className="modal">
          <div className="modal-content save-period-modal">
            <h3>경기 시간대 선택</h3>
            <p className="modal-subtitle">언제 경기를 하셨나요?</p>
            <div className="period-selection">
              <button
                className="period-btn first-half"
                onClick={() => saveWithPeriod("전반전")}
              >
                <span className="period-icon">◀</span>
                <span className="period-label">전반전</span>
              </button>
              <button
                className="period-btn second-half"
                onClick={() => saveWithPeriod("후반전")}
              >
                <span className="period-label">후반전</span>
                <span className="period-icon">▶</span>
              </button>
            </div>
            <button className="cancel-btn" onClick={() => setShowSavePeriodModal(false)}>
              취소
            </button>
          </div>
        </div>
      )}

      {/* 전체 선택 확인 모달 */}
      <ConfirmModal
        isOpen={showSelectAllModal}
        onClose={() => setShowSelectAllModal(false)}
        onConfirm={confirmSelectAll}
        title="전체 선택"
        message={`총 ${squad?.members.length || 0}명의 멤버를 모두 선택하시겠습니까?`}
        confirmText="선택"
      />

      {/* 전체 해제 확인 모달 */}
      <ConfirmModal
        isOpen={showClearAllModal}
        onClose={() => setShowClearAllModal(false)}
        onConfirm={confirmClearAll}
        title="전체 해제"
        message="선택된 모든 참가자를 해제하시겠습니까?"
        confirmText="해제"
      />

      {/* 저장 성공 모달 */}
      {showSaveSuccessModal && (
        <div className="modal">
          <div className="modal-content save-success-modal">
            <div className="success-icon">✓</div>
            <h3>저장 완료!</h3>
            <p className="modal-message">{saveSuccessMessage}</p>
            <p className="modal-hint">
              💡 저장된 결과는 <strong>출석률 탭</strong>에서 확인할 수 있습니다
            </p>
            <div className="modal-actions">
              <button onClick={() => setShowSaveSuccessModal(false)}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 알림 모달 */}
      <AlertModal
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        message={alertMessage}
      />
    </>
  );
};

export default DivisionPage;
