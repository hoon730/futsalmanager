// 모달 포커스 트랩 — 라이브러리 없이 직접 구현
// - 모달 mount 시 첫 번째 focusable 요소에 포커스
// - Tab / Shift+Tab 시 컨테이너 내부에서 순환
// - unmount 시 이전 포커스 위치 복원
//
// 사용처: 모달 컴포넌트에서 컨테이너 ref 와 함께 호출.
//   const ref = useRef<HTMLDivElement>(null);
//   useFocusTrap(ref);
//   return <div ref={ref}> ... </div>;
import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean = true,
) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previousActive = document.activeElement as HTMLElement | null;

    // 첫 진입 시 첫 번째 focusable 로 이동 (이미 모달 내부면 그대로)
    const initialFocusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (
      initialFocusables.length > 0 &&
      !container.contains(document.activeElement)
    ) {
      // requestAnimationFrame: portal mount 직후 autofocus 적용 충돌 회피
      requestAnimationFrame(() => initialFocusables[0]?.focus());
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      // 매 keydown 마다 다시 query (disabled 변화 / 동적 input 대응)
      const els = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (activeEl === last || !container.contains(activeEl)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      // 이전 포커스 복원 (모달 닫힌 뒤 호출자 트리거 버튼으로 돌아가도록)
      if (previousActive && document.contains(previousActive)) {
        previousActive.focus?.();
      }
    };
    // containerRef 는 ref 객체로 안정적 — active 만 dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
