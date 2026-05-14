import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { AuthPage } from "@/components/auth/AuthPage";
import { ClubSetupPage } from "@/components/club/ClubSetupPage";
import { useInitialLoad } from "@/hooks/useInitialLoad";
import { useAuthSquadLoad } from "@/hooks/useAuthSquadLoad";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useAutoSync } from "@/hooks/useAutoSync";
import { useSquadStore } from "@/stores/squadStore";
import { useAuthStore } from "@/stores/authStore";
import { AlertModal } from "@/components/modals/AlertModal";

const App = () => {
  const { user, isLoading: authLoading, initialize } = useAuthStore();
  const { squad } = useSquadStore();

  // 인증 상태 초기화
  useEffect(() => {
    initialize();
  }, [initialize]);

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
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>로딩 중...</p>
      </div>
    );
  }

  // 2. 비로그인 → 인증 페이지
  if (!user) {
    return <AuthPage />;
  }

  // 3. 로그인 완료, 동호회 데이터 로딩 중
  if (authDataLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>동호회 데이터 로드 중...</p>
      </div>
    );
  }

  // 4. 로그인했지만 동호회 미설정
  if (!squad?.id) {
    return <ClubSetupPage />;
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
    </>
  );
};

export default App;
