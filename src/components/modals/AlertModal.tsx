import { createPortal } from 'react-dom';

interface IAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
}

export const AlertModal = ({ isOpen, onClose, title = "알림", message }: IAlertModalProps) => {
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
        <h3 className="text-lg font-black italic uppercase text-white mb-3">{title}</h3>
        <p className="text-sm text-white/60 font-medium leading-relaxed mb-8" style={{ whiteSpace: 'pre-line' }}>{message}</p>

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
    </div>,
    document.body
  );
};
