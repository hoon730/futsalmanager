import { useState, useEffect } from 'react';
import { useSquadStore } from '@/stores/squadStore';
import { useDivisionStore } from '@/stores/divisionStore';
import { useFixedTeamStore } from '@/stores/fixedTeamStore';
import { AlertModal } from '@/components/modals/AlertModal';
import { SupabaseSync } from "@/components/settings/SupabaseSync";
import { ConfirmModal } from '@/components/modals/ConfirmModal';

interface SettingsPageProps {
  isConnected: boolean;
}

export default function SettingsPage({ isConnected }: SettingsPageProps) {
  const { squad, updateSquadName, addMember, removeMember, clearAllData } = useSquadStore();
  const name = squad?.name || '내 스쿼드';
  const members = squad?.members || [];
  const { clearAllDivisions } = useDivisionStore();
  const { fixedTeams, removeFixedTeam } = useFixedTeamStore();

  // 입력 상태
  const [newMemberName, setNewMemberName] = useState('');
  const [editingSquadName, setEditingSquadName] = useState('');

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
  const [squadNameModal, setSquadNameModal] = useState(false);
  const [removeMemberModal, setDeleteMemberModal] = useState<{
    isOpen: boolean;
    memberId: string;
    memberName: string;
  }>({
    isOpen: false,
    memberId: '',
    memberName: '',
  });

  // 페이지네이션 상태
  const [currentMemberPage, setCurrentMemberPage] = useState(1);
  const itemsPerPage = 5;

  // 스쿼드 이름 변경 모달 열기
  const openEditSquadNameModal = () => {
    setEditingSquadName(name);
    setSquadNameModal(true);
  };

  // 스쿼드 이름 변경 확인
  const confirmEditSquadName = () => {
    const trimmedName = editingSquadName.trim();
    if (!trimmedName) {
      setAlertModal({ isOpen: true, message: '스쿼드 이름을 입력해주세요' });
      return;
    }

    updateSquadName(trimmedName);
    setSquadNameModal(false);
    setEditingSquadName('');
  };

  // 멤버 추가
  const handleAddMember = () => {
    const name = newMemberName.trim();

    if (!name) {
      setAlertModal({ isOpen: true, message: '이름을 입력해주세요' });
      return;
    }

    // 중복 체크
    if (members.some((m: any) => m.name === name)) {
      setAlertModal({ isOpen: true, message: '이미 등록된 멤버입니다' });
      return;
    }

    addMember({ id: Date.now().toString(), name, active: true, createdAt: new Date().toISOString() });
    setNewMemberName('');
  };

  // 멤버 삭제 확인 모달 열기
  const openDeleteMemberModal = (memberId: string, memberName: string) => {
    setDeleteMemberModal({
      isOpen: true,
      memberId,
      memberName,
    });
  };

  // 멤버 삭제 확인
  const confirmDeleteMember = () => {
    if (removeMemberModal.memberId) {
      removeMember(removeMemberModal.memberId);
      setDeleteMemberModal({ isOpen: false, memberId: '', memberName: '' });
    }
  };

  // 고정 팀 삭제 확인
  const confirmDeleteFixedTeam = (teamId: string) => {
    setConfirmModal({
      isOpen: true,
      title: '고정 팀 삭제',
      message: '이 고정 팀을 삭제하시겠습니까?',
      onConfirm: () => {
        removeFixedTeam(teamId);
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
    });
  };

  // 이력 전체 삭제 확인
  const confirmClearHistory = () => {
    setConfirmModal({
      isOpen: true,
      title: '⚠️ 경고',
      message: '모든 경기 이력을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.',
      onConfirm: () => {
        clearAllDivisions();
        setAlertModal({ isOpen: true, message: '이력이 삭제되었습니다' });
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
    });
  };

  // 모든 데이터 초기화 확인
  const confirmResetAll = () => {
    setConfirmModal({
      isOpen: true,
      title: '⚠️ 위험',
      message:
        '모든 데이터(스쿼드, 멤버, 이력)를 초기화하시겠습니까? 이 작업은 취소할 수 없습니다.',
      onConfirm: () => {
        clearAllDivisions();
        clearAllData();
        setAlertModal({ isOpen: true, message: '모든 데이터가 초기화되었습니다' });
        setConfirmModal({ ...confirmModal, isOpen: false });
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      },
    });
  };

  // 페이지네이션된 멤버 목록
  const paginatedMembers = () => {
    const startIdx = (currentMemberPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    return members.slice(startIdx, endIdx);
  };

  const totalMemberPages = Math.ceil(members.length / itemsPerPage);

  // Enter 키로 멤버 추가
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.target as HTMLElement).id === 'memberNameInput') {
        e.preventDefault();
        handleAddMember();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [newMemberName, members]);

  // Enter 키로 스쿼드 이름 변경
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && squadNameModal) {
        e.preventDefault();
        confirmEditSquadName();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [squadNameModal, editingSquadName]);

  return (
    <div style={{ paddingBottom: 'calc(75px + env(safe-area-inset-bottom))' }}>
      {/* 스쿼드 정보 섹션 */}
      <section className="section">
        <h2>📝 스쿼드 정보</h2>
        <div className="squad-info">
          <div className="info-row">
            <span className="label">스쿼드 이름:</span>
            <span className="value">{name}</span>
          </div>
          <button className="btn-secondary" onClick={openEditSquadNameModal}>
            이름 변경
          </button>
        </div>
      </section>

      {/* 멤버 관리 섹션 */}
      <section className="section">
        <h2>👥 멤버 관리</h2>
        <div className="member-count">{members.length}명 등록</div>
        <div className="member-input">
          <input
            id="memberNameInput"
            type="text"
            placeholder="멤버 이름 입력"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
          />
          <button onClick={handleAddMember}>추가</button>
        </div>
        <div className="member-list">
          {members.length === 0 ? (
            <p className="empty-message">등록된 멤버가 없습니다</p>
          ) : (
            <>
              {paginatedMembers().map((member) => (
                <div key={member.id} className="member-item">
                  <span className="member-item-name">{member.name}</span>
                  <div className="member-actions">
                    <button
                      className="btn-delete"
                      onClick={() => openDeleteMemberModal(member.id, member.name)}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
              {totalMemberPages > 1 && (
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    disabled={currentMemberPage === 1}
                    onClick={() => setCurrentMemberPage(currentMemberPage - 1)}
                  >
                    ◀
                  </button>
                  <span className="pagination-info">
                    {currentMemberPage} / {totalMemberPages}
                  </span>
                  <button
                    className="pagination-btn"
                    disabled={currentMemberPage === totalMemberPages}
                    onClick={() => setCurrentMemberPage(currentMemberPage + 1)}
                  >
                    ▶
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* 고정 팀 관리 섹션 */}
      <section className="section">
        <h2>🔗 고정 팀 관리</h2>
        <div className="fixed-team-list">
          {fixedTeams.length === 0 ? (
            <p className="empty-message">고정 팀이 없습니다</p>
          ) : (
            fixedTeams.map((team: any) => {
              const playerNames = team.players.map((p: any) => p.name).join(', ');
              return (
                <div key={team.id} className="fixed-team-item">
                  <span>🔗 {playerNames}</span>
                  <button className="btn-delete" onClick={() => confirmDeleteFixedTeam(team.id)}>
                    삭제
                  </button>
                </div>
              );
            })
          )}
        </div>
        <p className="empty-message" style={{ fontSize: '0.85em', padding: '10px 0' }}>
          💡 고정 팀은 팀배정 탭에서 추가할 수 있습니다
        </p>
      </section>
      {/* Supabase 동기화 섹션 */}
      <SupabaseSync isConnected={isConnected} />


      {/* 데이터 관리 섹션 */}
      <section className="section danger-zone">
        <h2 className="danger-zone-title">🗑️ 데이터 관리</h2>
        <button className="btn-danger" onClick={confirmClearHistory}>
          이력 전체 삭제
        </button>
        <button className="btn-danger" onClick={confirmResetAll}>
          모든 데이터 초기화
        </button>
      </section>

      {/* 스쿼드 이름 변경 모달 */}
      {squadNameModal && (
        <div className="modal" style={{ display: 'flex' }} onClick={() => setSquadNameModal(false)}>
          <div className="modal-content edit-name-modal" onClick={(e) => e.stopPropagation()}>
            <h3>스쿼드 이름 변경</h3>
            <input
              type="text"
              className="modal-input"
              placeholder="새로운 스쿼드 이름 입력"
              maxLength={20}
              value={editingSquadName}
              onChange={(e) => setEditingSquadName(e.target.value)}
              autoFocus
            />
            <div className="modal-actions">
              <button onClick={confirmEditSquadName}>변경</button>
              <button onClick={() => setSquadNameModal(false)}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 멤버 삭제 확인 모달 */}
      {removeMemberModal.isOpen && (
        <div
          className="modal"
          style={{ display: 'flex' }}
          onClick={() => setDeleteMemberModal({ isOpen: false, memberId: '', memberName: '' })}
        >
          <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>멤버 삭제</h3>
            <p className="modal-message">
              <span>{removeMemberModal.memberName}</span>을(를) 정말로 삭제하시겠습니까?
            </p>
            <p className="modal-warning">⚠️ 이 작업은 되돌릴 수 없습니다</p>
            <div className="modal-actions">
              <button className="btn-danger-confirm" onClick={confirmDeleteMember}>
                삭제
              </button>
              <button
                onClick={() =>
                  setDeleteMemberModal({ isOpen: false, memberId: '', memberName: '' })
                }
              >
                취소
              </button>
            </div>
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
