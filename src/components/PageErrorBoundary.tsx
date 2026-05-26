import { Component, type ReactNode } from "react";
import { logger } from "@/lib/logger";
import { isChunkLoadError } from "@/lib/lazyWithRetry";

interface Props {
  children: ReactNode;
  /** fallback UI 에 표시할 페이지 라벨 (선택) */
  pageLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 페이지 단위 에러 경계.
 * 한 페이지에서 렌더링 오류가 발생해도 전체 앱은 살아 있도록 격리한다.
 *
 * chunk-load 에러는 ChunkErrorBoundary 가 처리하도록 다시 throw.
 * (일반 React 렌더 에러만 이 boundary 가 잡음)
 *
 * 사용처: Layout 의 페이지 스왑 자리에 wrap. key 에 activeTab 을 주면
 * 탭 전환 시 에러 상태가 자연스럽게 reset 된다.
 */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): State | null {
    if (isChunkLoadError(error)) {
      // chunk 에러는 상위 ChunkErrorBoundary 가 처리
      throw error;
    }
    return {
      hasError: true,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  componentDidCatch(error: unknown, info: unknown) {
    logger.error("[PageErrorBoundary]", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex items-center justify-center min-h-[60vh] px-6">
        <div
          className="w-full max-w-sm rounded-2xl p-6 text-center"
          style={{
            background: "rgba(22,28,22,0.98)",
            border: "1px solid rgba(239,68,68,0.20)",
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: "rgba(239,68,68,0.10)" }}
          >
            <span className="material-icons text-red-400 text-xl">error_outline</span>
          </div>
          <h2 className="text-base font-black italic uppercase tracking-tighter text-white mb-2">
            화면을 그릴 수 없어요
          </h2>
          <p className="text-xs text-white/50 leading-relaxed mb-5">
            {this.props.pageLabel ? `${this.props.pageLabel} 페이지에서 ` : ""}
            오류가 발생했어요.
            <br />
            다시 시도하거나 다른 탭으로 이동해 보세요.
          </p>
          <button
            onClick={this.handleRetry}
            className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
            style={{ backgroundColor: "#0DF23E", color: "#0a150d" }}
          >
            <span className="material-icons text-sm align-middle mr-1">refresh</span>
            다시 시도
          </button>
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-[10px] text-red-400/60 mt-4 text-left overflow-auto max-h-24 whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
