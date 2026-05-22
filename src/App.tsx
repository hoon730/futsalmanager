import { useState, useEffect, Suspense } from "react";
import Layout from "@/components/Layout";
import { useInitialLoad } from "@/hooks/useInitialLoad";
import { useAuthSquadLoad } from "@/hooks/useAuthSquadLoad";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useAutoSync } from "@/hooks/useAutoSync";
import { useSquadStore } from "@/stores/squadStore";
import { useAuthStore } from "@/stores/authStore";
import { AlertModal } from "@/components/modals/AlertModal";
import { ToastContainer } from "@/components/Toast";
import { lazyWithRetry, clearChunkReloadFlag } from "@/lib/lazyWithRetry";
import { ChunkErrorBoundary } from "@/components/ChunkErrorBoundary";

// 로그인 전/동호회 미설정 화면도 lazy-load — 정상 진입 후엔 다운로드 안 함
// lazyWithRetry: 배포 직후 stale chunk 404 발생 시 자동 reload로 복구
const AuthPage      = lazyWithRetry(() => import("@/components/auth/AuthPage").then(m => ({ default: m.AuthPage })));
const ClubSetupPage = lazyWithRetry(() => import("@/components/club/ClubSetupPage").then(m => ({ default: m.ClubSetupPage })));

const FullscreenLoader = ({ message }: { message: string }) => (
  <div className="loading-screen">
    <div className="loading-spinner"></div>
    <p>{message}</p>
  </div>
);

const App = () => {
  const { user, isLoading: authLoading, initialize } = useAuthStore();
  const { squad } = useSquadStore();

  // 인증 상태 초기화
  useEffect(() => {
    initialize();
  }, [initialize]);

  // App이 정상적으로 마운트되었으므로 chunk 재시도 플래그 초기화
  // (다음 배포에서 다시 stale chunk 발생 시 자동 reload가 재개되도록)
  useEffect(() => {
    clearChunkReloadFlag();
  }, []);

  // v2 브랜치: 항상 인증 필요 — 레거시 로드 비활성화
  useInitialLoad(false);
  const { isLoading: authDataLoading } = useAuthSquadLoad(user?.id);

  const { isConnected } = useRealtimeSync(squad?.id || null);
  const [syncErrorModal, setSyncErrorModal] = useState(false);

  useAutoSync();

  const hasData = (squad?.members?.length ?? 0) > 0;
  useEffect(() => {
    if (isConnected || hasData || authDataLoading || !squad?.id) return;
    const timer = setTimeout(() => {
      if (!isConnected && !hasData) setSyncErrorModal(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isConnected, squad?.id, authDataLoading, hasData]);

  // 1. 인증 확인 중
  if (authLoading) {
    return <FullscreenLoader message="로딩 중..." />;
  }

  // 2. 비로그인 → 인증 페이지
  if (!user) {
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<FullscreenLoader message="로딩 중..." />}>
          <AuthPage />
        </Suspense>
      </ChunkErrorBoundary>
    );
  }

  // 3. 로그인 완료, 동호회 데이터 로딩 중
  if (authDataLoading) {
    return <FullscreenLoader message="동호회 데이터 로드 중..." />;
  }

  // 4. 로그인했지만 동호회 미설정
  if (!squad?.id) {
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<FullscreenLoader message="로딩 중..." />}>
          <ClubSetupPage />
        </Suspense>
      </ChunkErrorBoundary>
    );
  }

  // 5. 정상 진입
  return (
    <>
      <Layout />
      <AlertModal
        isOpen={syncErrorModal}
        message="⚠️ 실시간 동기화 연결 실패\n\n인터넷 연결을 확인해주세요."
        onClose={() => setSyncErrorModal(false)}
      />
      <ToastContainer />
    </>
  );
};

export default App;
