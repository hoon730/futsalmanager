import { createPortal } from 'react-dom';

interface IConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "확인",
  message,
  confirmText = "확인",
  cancelText = "뒤로가기",
  isDanger = false,
}: IConfirmModalProps) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

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
        <h3 className="text-lg font-black italic uppercase text-white mb-3">{title}</h3>
        <p className="text-sm text-white/60 font-medium leading-relaxed mb-8">{message}</p>

        <div className="space-y-3">
          <button
            onClick={handleConfirm}
            className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95"
            style={isDanger
              ? { backgroundColor: '#ef4444', color: '#fff' }
              : { backgroundColor: '#0DF23E', color: '#0a150d' }
            }
          >
            {confirmText}
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
            {cancelText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
