import { createPortal } from "react-dom";
import { useToastStore, type IToast } from "@/stores/toastStore";

const ICONS: Record<IToast["type"], string> = {
  info:    "info",
  success: "check_circle",
  error:   "error",
};

const COLORS: Record<IToast["type"], string> = {
  info:    "#60a5fa",
  success: "#0DF23E",
  error:   "#ef4444",
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed inset-x-0 z-[200000] flex flex-col items-center gap-2 px-6 pointer-events-none"
      style={{ bottom: "max(28px, env(safe-area-inset-bottom))" }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2 max-w-sm rounded-full px-4 py-2.5 shadow-lg pointer-events-auto"
          style={{
            background: "rgba(22,28,22,0.95)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
            animation: "toastSlideUp 0.25s ease-out",
          }}
        >
          <span className="material-icons text-base" style={{ color: COLORS[t.type] }}>
            {ICONS[t.type]}
          </span>
          <span className="text-sm font-bold text-white/90">{t.message}</span>
        </div>
      ))}
      <style>{`
        @keyframes toastSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
}
