import { useState, useRef, useMemo, useEffect } from "react";
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
import type { IMember, IFixedTeam } from "@/types";

// 한글/영문 정렬 함수
const sortByName = (a: IMember, b: IMember) => {
  return a.name.localeCompare(b.name, ['ko', 'en']);
};

const DivisionPage = () => {
  const { squad, selectedParticipants, toggleParticipant, selectAllParticipants, clearAllParticipants } = useSquadStore();
  const { fixedTeams, addFixedTeam } = useFixedTeamStore();
  const { saveDivision, teammateHistory, updateTeammateHistory: updateStoreHistory } = useDivisionStore();

  const [currentTeams, setCurrentTeams] = useState<IMember[][] | null>(null);
  const [_teamCount, __setTeamCount] = useState(2);
  const [currentParticipantPage, setCurrentParticipantPage] = useState(1);
  const participantSwiperRef = useRef<SwiperType | null>(null);

  // 용병 관련 state
  const [mercenaries, setMercenaries] = useState<IMember[]>(() => {
    const saved = localStorage.getItem('mercenaries');
    return saved ? JSON.parse(saved) : [];
  });
  const [newMercenaryName, setNewMercenaryName] = useState("");
  const [selectedMercenaries, setSelectedMercenaries] = useState<string[]>([]);
  const [currentMercenaryPage, setCurrentMercenaryPage] = useState(1);
  const mercenarySwiperRef = useRef<SwiperType | null>(null);

  // 용병 고정팀 모달
  const [showMercenaryFixedTeamModal, setShowMercenaryFixedTeamModal] = useState(false);
  const [selectedMercenariesForTeam, setSelectedMercenariesForTeam] = useState<string[]>([]);

  // 용병 데이터 localStorage 저장
  useEffect(() => {
    localStorage.setItem('mercenaries', JSON.stringify(mercenaries));
  }, [mercenaries]);

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
  const selectedMercenaryCount = selectedMercenaries.length;
  const totalParticipants = selectedCount + selectedMercenaryCount;

  // 정렬된 멤버 리스트
  const sortedMembers = useMemo(() => {
    if (!squad || !squad.members) return [];
    return [...squad.members].sort(sortByName);
  }, [squad]);

  // 정렬된 용병 리스트
  const sortedMercenaries = useMemo(() => {
    return [...mercenaries].sort(sortByName);
  }, [mercenaries]);

  // 용병 추가
  const handleAddMercenary = () => {
    const name = newMercenaryName.trim();
    if (!name) {
      setAlertMessage("용병 이름을 입력해주세요");
      setShowAlert(true);
      return;
    }

    // 중복 체크 (용병 리스트 내)
    if (mercenaries.some((m) => m.name === name)) {
      setAlertMessage("이미 추가된 용병입니다");
      setShowAlert(true);
      return;
    }

    // 정규 멤버와 중복 체크
    if (squad?.members.some((m) => m.name === name)) {
      setAlertMessage("정규 멤버와 동일한 이름입니다");
      setShowAlert(true);
      return;
    }

    const newMercenary: IMember = {
      id: `mercenary_${Date.now()}`,
      name,
      active: true,
      createdAt: new Date().toISOString(),
      isMercenary: true, // 용병 표시
    };

    setMercenaries([...mercenaries, newMercenary]);
    setSelectedMercenaries([...selectedMercenaries, newMercenary.id]); // 팀 배정용 자동 체크
    setSelectedMercenariesForTeam([...selectedMercenariesForTeam, newMercenary.id]); // 고정팀 모달용 자동 체크
    setNewMercenaryName("");
  };

  // 용병 삭제
  const handleRemoveMercenary = (id: string) => {
    setMercenaries(mercenaries.filter((m) => m.id !== id));
    setSelectedMercenaries(selectedMercenaries.filter((mid) => mid !== id));
    setSelectedMercenariesForTeam(selectedMercenariesForTeam.filter((mid) => mid !== id));
  };

  // 용병 선택 토글
  const toggleMercenary = (id: string) => {
    setSelectedMercenaries((prev) =>
      prev.includes(id) ? prev.filter((mid) => mid !== id) : [...prev, id]
    );
  };

  // 통합 고정팀 추가 (정규 멤버 + 용병)
  const handleAddMercenaryFixedTeam = () => {
    if (selectedMercenariesForTeam.length < 2) {
      setAlertMessage("최소 2명 이상 선택해주세요");
      setShowAlert(true);
      return;
    }

    // 정규 멤버와 용병을 함께 찾기
    const allPlayers = [...(squad?.members || []), ...mercenaries];
    const selectedPlayers = allPlayers.filter((p) =>
      selectedMercenariesForTeam.includes(p.id)
    );

    const newFixedTeam: IFixedTeam = {
      id: Date.now().toString(),
      playerIds: selectedPlayers.map((p) => p.id),
      players: selectedPlayers,
      active: true,
    };

    addFixedTeam(newFixedTeam);
    setSelectedMercenariesForTeam([]);
    setShowMercenaryFixedTeamModal(false);
    setAlertMessage("고정팀이 추가되었습니다");
    setShowAlert(true);
  };

  // 페이지네이션 설정
  const itemsPerPage = 5;
  const totalPages = Math.ceil(sortedMembers.length / itemsPerPage);
  const totalMercenaryPages = Math.ceil(sortedMercenaries.length / itemsPerPage);

  const paginatedMembers = useMemo(() => {
    const result: IMember[][] = [];
    for (let i = 0; i < sortedMembers.length; i += itemsPerPage) {
      result.push(sortedMembers.slice(i, i + itemsPerPage));
    }
    return result;
  }, [sortedMembers]);

  const paginatedMercenaries = useMemo(() => {
    const result: IMember[][] = [];
    for (let i = 0; i < sortedMercenaries.length; i += itemsPerPage) {
      result.push(sortedMercenaries.slice(i, i + itemsPerPage));
    }
    return result;
  }, [sortedMercenaries]);

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
    if (totalParticipants < 2) {
      setAlertMessage("최소 2명 이상 선택해주세요");
      setShowAlert(true);
      return;
    }
    setShowTeamCountModal(true);
  };

  const selectTeamCountAndDivide = async (count: number) => {

    setShowTeamCountModal(false);

    // 정규 멤버 + 용병
    const regularMembers: IMember[] = selectedParticipants
      .map((id) => squad?.members.find((m) => m.id === id))
      .filter((m): m is IMember => m !== undefined);

    const selectedMercs: IMember[] = selectedMercenaries
      .map((id) => mercenaries.find((m) => m.id === id))
      .filter((m): m is IMember => m !== undefined);

    const activePlayers = [...regularMembers, ...selectedMercs];

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
            <p className="empty-message">설정 탭에서 스쿼드 멤버를 <br/> 먼저 추가해주세요</p>
          </div>
        ) : totalPages === 1 ? (
          <>
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
            <div className="participant-total-count">
              <span id="selectedCount">{selectedCount}명 선택됨</span>
            </div>
          </>
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
            <div className="participant-total-count">
                <span id="selectedCount">{selectedCount}명 선택됨</span>
              </div>
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

      {/* 용병 추가 섹션 */}
      <section className="section">
        <h2>⚡ 용병 추가</h2>
        <div className="participant-guest-info">
          <span id="selectedMercenaryCount">{selectedMercenaryCount}명 선택됨</span>
            {totalParticipants >= 2 && (
              <button
                className="btn-small"
                onClick={() => setShowMercenaryFixedTeamModal(true)}
              >
                고정팀 설정
              </button>
            )}
        </div>

        <div className="member-input" style={{ marginBottom: "15px" }}>
          <input
            type="text"
            placeholder="용병 이름 입력"
            value={newMercenaryName}
            onChange={(e) => setNewMercenaryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddMercenary();
              }
            }}
          />
          <button onClick={handleAddMercenary}>추가</button>
        </div>

        {mercenaries.length === 0 ? (
          <div className="participant-checkboxes">
            <p className="empty-message">용병을 추가해주세요</p>
          </div>
        ) : totalMercenaryPages === 1 ? (
          <div className="participant-checkboxes">
            {sortedMercenaries.map((mercenary) => (
              <div key={mercenary.id} className="checkbox-item">
                <input
                  type="checkbox"
                  id={`mercenary-${mercenary.id}`}
                  checked={selectedMercenaries.includes(mercenary.id)}
                  onChange={() => toggleMercenary(mercenary.id)}
                />
                <label htmlFor={`mercenary-${mercenary.id}`}>{mercenary.name}</label>
                <button
                  className="btn-delete-inline"
                  onClick={() => handleRemoveMercenary(mercenary.id)}
                  style={{
                    marginLeft: "auto",
                    marginRight: "16px",
                    padding: "4px 8px",
                    fontSize: "0.8em",
                    background: "#ff0055",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        ) : (
          <>
            <Swiper
              slidesPerView={1}
              onSwiper={(swiper) => {
                mercenarySwiperRef.current = swiper;
              }}
              onSlideChange={(swiper) => setCurrentMercenaryPage(swiper.activeIndex + 1)}
              allowTouchMove={true}
              className="participant-swiper"
            >
              {paginatedMercenaries.map((pageMembers, pageIndex) => (
                <SwiperSlide key={pageIndex}>
                  <div className="participant-checkboxes">
                    {pageMembers.map((mercenary) => (
                      <div key={mercenary.id} className="checkbox-item">
                        <input
                          type="checkbox"
                          id={`mercenary-${mercenary.id}`}
                          checked={selectedMercenaries.includes(mercenary.id)}
                          onChange={() => toggleMercenary(mercenary.id)}
                        />
                        <label htmlFor={`mercenary-${mercenary.id}`}>{mercenary.name}</label>
                        <button
                          className="btn-delete-inline"
                          onClick={() => handleRemoveMercenary(mercenary.id)}
                          style={{
                            marginLeft: "auto",
                            marginRight: "16px",
                            padding: "4px 8px",
                            fontSize: "0.8em",
                            background: "#ff0055",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
            {totalMercenaryPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  disabled={currentMercenaryPage === 1}
                  onClick={() => mercenarySwiperRef.current?.slidePrev()}
                >
                  ◀
                </button>
                <span className="pagination-info">
                  {currentMercenaryPage} / {totalMercenaryPages}
                </span>
                <button
                  className="pagination-btn"
                  disabled={currentMercenaryPage === totalMercenaryPages}
                  onClick={() => mercenarySwiperRef.current?.slideNext()}
                >
                  ▶
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* 총 인원 표시 */}
      {totalParticipants > 0 && (
        <section className="section total-participants-section">
          <div
            style={{
              padding: "15px 20px",
              background: "linear-gradient(135deg, #00ff41 0%, #00cc33 100%)",
              borderRadius: "12px",
              color: "#000",
              fontWeight: "bold",
              fontSize: "1.1em",
              textAlign: "center",
              boxShadow: "0 4px 15px rgba(0, 255, 65, 0.3)",
            }}
          >
            <span style={{ fontSize: "1.3em", marginRight: "5px" }}>👥</span>
            총 인원: {selectedCount}명 (멤버) + {selectedMercenaryCount}명 (용병) ={" "}
            <span style={{ fontSize: "1.3em", color: "#000" }}>{totalParticipants}명</span>
          </div>
        </section>
      )}

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

      {/* 통합 고정팀 설정 모달 (정규 멤버 + 용병) */}
      {showMercenaryFixedTeamModal && (
        <div className="modal">
          <div className="modal-content">
            <h3 style={{ marginBottom: "8px" }}>🔗 고정팀 설정</h3>
            <p style={{ fontSize: "0.9em", color: "#aaa", margin: "0 0 12px 0", textAlign: "left" }}>
              같은 팀으로 묶을 멤버를 선택하세요 (2명 이상)
            </p>
            <div className="checkbox-group" style={{ maxHeight: "400px", overflowY: "auto" }}>
              {/* 정규 멤버 */}
              {squad && squad.members.length > 0 && (
                <>
                  <div style={{ padding: "8px 0", fontWeight: "bold", color: "#00ff41", borderBottom: "1px solid #333" }}>
                    👥 정규 멤버
                  </div>
                  {sortedMembers.map((member) => (
                    <div key={member.id} className="checkbox-item">
                      <input
                        type="checkbox"
                        id={`fixed-member-${member.id}`}
                        checked={selectedMercenariesForTeam.includes(member.id)}
                        onChange={() => {
                          setSelectedMercenariesForTeam((prev) =>
                            prev.includes(member.id)
                              ? prev.filter((id) => id !== member.id)
                              : [...prev, member.id]
                          );
                        }}
                      />
                      <label htmlFor={`fixed-member-${member.id}`}>{member.name}</label>
                    </div>
                  ))}
                </>
              )}

              {/* 용병 */}
              {mercenaries.length > 0 && (
                <>
                  <div style={{ padding: "8px 0", fontWeight: "bold", color: "#ff6b00", borderBottom: "1px solid #333", marginTop: "16px" }}>
                    ⚡ 용병
                  </div>
                  {sortedMercenaries.map((mercenary) => (
                    <div key={mercenary.id} className="checkbox-item">
                      <input
                        type="checkbox"
                        id={`fixed-mercenary-${mercenary.id}`}
                        checked={selectedMercenariesForTeam.includes(mercenary.id)}
                        onChange={() => {
                          setSelectedMercenariesForTeam((prev) =>
                            prev.includes(mercenary.id)
                              ? prev.filter((id) => id !== mercenary.id)
                              : [...prev, mercenary.id]
                          );
                        }}
                      />
                      <label htmlFor={`fixed-mercenary-${mercenary.id}`}>
                        {mercenary.name}
                        <span style={{ marginLeft: "6px", fontSize: "0.75em", color: "#ff6b00" }}>용병</span>
                      </label>
                    </div>
                  ))}
                </>
              )}
            </div>
            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button onClick={handleAddMercenaryFixedTeam}>
                고정팀 추가 ({selectedMercenariesForTeam.length}명 선택)
              </button>
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowMercenaryFixedTeamModal(false);
                  setSelectedMercenariesForTeam([]);
                }}
              >
                취소
              </button>
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
