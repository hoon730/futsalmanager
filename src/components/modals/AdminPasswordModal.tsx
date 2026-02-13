import { useState, useEffect } from 'react';

interface AdminPasswordModalProps {
  isOpen: boolean;
  onConfirm: (password: string) => void;
  onClose: () => void;
}

export function AdminPasswordModal({ isOpen, onConfirm, onClose }: AdminPasswordModalProps) {
  const [password, setPassword] = useState('');

  // Enter 키로 확인
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && isOpen) {
        e.preventDefault();
        onConfirm(password);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, password, onConfirm, onClose]);

  // 모달이 닫힐 때 비밀번호 초기화
  useEffect(() => {
    if (!isOpen) {
      setPassword('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal" style={{ display: 'flex' }} onClick={onClose}>
      <div className="modal-content admin-password-modal" onClick={(e) => e.stopPropagation()}>
        <h3>🔐 관리자 인증</h3>
        <p className="modal-message">관리자 비밀번호를 입력하세요</p>
        <input
          type="password"
          className="modal-input"
          placeholder="비밀번호 입력"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <div className="modal-actions">
          <button onClick={() => onConfirm(password)}>확인</button>
          <button onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}
