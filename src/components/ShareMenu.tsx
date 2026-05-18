import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ShareMenuItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

interface Props {
  title?: string;
  items: ShareMenuItem[];
  trigger: (open: () => void) => ReactNode;
}

/**
 * 공유 메뉴 — 트리거 버튼 + 중앙 모달
 * 사용 예:
 *   <ShareMenu
 *     title="초대 코드 공유"
 *     items={[
 *       { label: "코드 복사", icon: <span className="material-icons">content_copy</span>, onClick: handleCopy },
 *       { label: "카카오톡으로 보내기", icon: <KakaoIcon />, onClick: handleKakao },
 *     ]}
 *     trigger={(open) => <button onClick={open}>공유</button>}
 *   />
 */
export function ShareMenu({ title = "공유", items, trigger }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {trigger(() => setOpen(true))}
      {open && createPortal(
        <div
          className="fixed inset-0 z-[100001] bg-black/80 backdrop-blur-lg flex items-center justify-center px-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl overflow-hidden"
            style={{ background: "rgba(22,28,22,0.98)", border: "1px solid rgba(255,255,255,0.08)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-3 border-b border-white/5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{title}</p>
            </div>
            <div className="py-1">
              {items.map((item, i) => (
                <button
                  key={i}
                  onClick={() => { item.onClick(); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors"
                >
                  <span className="flex items-center justify-center w-6 h-6 flex-shrink-0">{item.icon}</span>
                  <span className={`text-sm font-bold ${item.destructive ? "text-red-400" : "text-white/85"}`}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-full py-3 text-xs font-black uppercase tracking-widest text-white/40 border-t border-white/5 hover:bg-white/[0.02] transition-colors"
            >
              취소
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
