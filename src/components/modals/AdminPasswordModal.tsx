import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface AdminPasswordModalProps {
  isOpen: boolean;
  onConfirm: (password: string) => void;
  onClose: () => void;
}

export function AdminPasswordModal({ isOpen, onConfirm, onClose }: AdminPasswordModalProps) {
  const [password, setPassword] = useState('');

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

  useEffect(() => {
    if (!isOpen) setPassword('');
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center px-6 animate-fade-in"
      style={{ zIndex: 9999 }}
      onClick={onClose}
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
        <h3 className="text-lg font-black italic uppercase text-white mb-3">🔐 관리자 인증</h3>
        <p className="text-sm text-white/60 font-medium leading-relaxed mb-6">관리자 비밀번호를 입력하세요</p>

        <input
          type="password"
          placeholder="비밀번호 입력"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none mb-6 text-white"
          onFocus={e => e.currentTarget.style.borderColor = 'rgba(13,242,62,0.5)'}
          onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
        />

        <div className="space-y-3">
          <button
            onClick={() => onConfirm(password)}
            className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95"
            style={{ backgroundColor: '#0DF23E', color: '#0a150d' }}
          >
            확인
          </button>
          <button
            onClick={onClose}
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
  );
}
