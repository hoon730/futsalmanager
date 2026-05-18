import { createPortal } from "react-dom";

interface AddMemberModalProps {
  name: string;
  onChangeName: (name: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function AddMemberModal({ name, onChangeName, onClose, onConfirm }: AddMemberModalProps) {
  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center px-6 z-[9999] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[2.5rem] p-8 relative overflow-hidden"
        style={{
          background: "rgba(22,28,22,0.98)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(13,242,62,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-black italic uppercase text-white mb-3">멤버 추가</h3>
        <p className="text-xs text-white/50 font-bold leading-relaxed mb-5">추가할 멤버 이름을 입력하세요</p>
        <input
          type="text"
          placeholder="멤버 이름"
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onConfirm(); }}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-all mb-6"
        />
        <div className="space-y-3">
          <button
            onClick={onConfirm}
            disabled={!name.trim()}
            className="w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40"
            style={{ backgroundColor: "#0DF23E", color: "#0a150d" }}
          >
            추가
          </button>
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-widest bg-white/5 border border-white/10 text-white/40 transition-all active:scale-95 hover:border-primary/30 hover:text-white/60"
          >
            뒤로가기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
