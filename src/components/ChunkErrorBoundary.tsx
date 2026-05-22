import { Component, type ReactNode } from "react";
import { isChunkLoadError, clearChunkReloadFlag } from "@/lib/lazyWithRetry";

interface Props {
  children: ReactNode;
}

interface State {
  hasChunkError: boolean;
}

/**
 * lazy import가 stale chunk 때문에 실패한 경우의 최후 방어선.
 * lazyWithRetry의 자동 reload가 한 번 시도된 후에도 실패하면 여기 잡혀서
 * 흰 화면이나 raw error 대신 안내 UI를 보여줌.
 *
 * chunk-load 외의 에러는 다시 throw해서 상위 boundary나 React가 처리하도록 둠.
 */
export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { hasChunkError: false };

  static getDerivedStateFromError(error: unknown): State | null {
    if (isChunkLoadError(error)) {
      return { hasChunkError: true };
    }
    // chunk 에러가 아니면 boundary가 잡지 않음 → 다시 throw하면 React가 다음 boundary로 전파
    throw error;
  }

  handleReload = async () => {
    // SW가 옛 index.html을 캐싱했을 가능성이 있으니 등록 해제 후 reload
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      /* ignore */
    }
    clearChunkReloadFlag();
    // cache: 'reload' 효과로 강제 새로고침
    window.location.reload();
  };

  render() {
    if (!this.state.hasChunkError) return this.props.children;

    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center px-6 bg-background-dark">
        <div
          className="w-full max-w-sm rounded-2xl p-7 text-center"
          style={{
            background: "rgba(22,28,22,0.98)",
            border: "1px solid rgba(13,242,62,0.15)",
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "rgba(13,242,62,0.10)" }}
          >
            <span className="material-icons text-primary text-2xl">
              system_update
            </span>
          </div>
          <h2 className="text-lg font-black italic uppercase tracking-tighter text-white mb-2">
            새 버전이 준비됐어요
          </h2>
          <p className="text-sm text-white/50 leading-relaxed mb-6">
            앱이 업데이트되어 다시 불러와야 해요.
            <br />
            아래 버튼을 눌러주세요.
          </p>
          <button
            onClick={this.handleReload}
            className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
            style={{ backgroundColor: "#0DF23E", color: "#0a150d" }}
          >
            <span className="material-icons text-sm align-middle mr-1">
              refresh
            </span>
            새로 불러오기
          </button>
          <p className="text-[10px] text-white/25 mt-4">
            잠시 끊긴 듯 보였다면 새 기능이 추가된 거예요
          </p>
        </div>
      </div>
    );
  }
}
