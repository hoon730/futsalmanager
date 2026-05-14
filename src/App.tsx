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

  // 인증 확인 완료 후 분기:
  // - 익명(main 브랜치): useInitialLoad로 "내 스쿼드" 자동 로드/생성
  // - 로그인(v2): useAuthSquadLoad로 squad_members 기반 로드
  const isAnonymous = !authLoading && !user;
  const { isLoading: legacyLoading, error: legacyError } = useInitialLoad(isAnonymous);
  const { isLoading: authDataLoading } = useAuthSquadLoad(user?.id);

  const isDataLoading = isAnonymous ? legacyLoading : authDataLoading;
  const loadError = isAnonymous ? legacyError : null;

  const { isConnected } = useRealtimeSync(squad?.id || null);
  const [syncErrorModal, setSyncErrorModal] = useState(false);

  useAutoSync();

  const hasData = (squad?.members?.length ?? 0) > 0;
  useEffect(() => {
    if (isConnected || hasData || isDataLoading || !squad?.id) return;
    const timer = setTimeout(() => {
      if (!isConnected && !hasData) setSyncErrorModal(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isConnected, squad?.id, isDataLoading, hasData]);

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
    // 레거시(main 브랜치) 데이터 로딩 중
    if (legacyLoading) {
      return (
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>데이터 로드 중...</p>
        </div>
      );
    }
    // 레거시 모드: 스쿼드 있으면 바로 앱 진입 (main 브랜치 호환)
    if (squad?.id) {
      return (
        <>
          <Layout />
          <AlertModal
            isOpen={syncErrorModal}
            message="⚠️ 실시간 동기화 연결 실패\n\n인터넷 연결을 확인해주세요."
            onClose={() => setSyncErrorModal(false)}
          />
          {loadError && (
            <AlertModal
              isOpen={!!loadError}
              message={`❌ 데이터 로드 실패\n\n${loadError}`}
              onClose={() => {}}
            />
          )}
        </>
      );
    }
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
