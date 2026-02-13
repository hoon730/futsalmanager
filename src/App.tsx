import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { useInitialLoad } from "@/hooks/useInitialLoad";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useAutoSync } from "@/hooks/useAutoSync";
import { useSquadStore } from "@/stores/squadStore";
import { AlertModal } from "@/components/modals/AlertModal";

const App = () => {
  const { isLoading, error: loadError } = useInitialLoad();
  const { squad } = useSquadStore();
  const { isConnected } = useRealtimeSync(squad?.id || null);
  const [syncErrorModal, setSyncErrorModal] = useState(false);

  // 자동 동기화 활성화
  useAutoSync();

  // 동기화 연결 실패 감지
  useEffect(() => {
    if (squad?.id && !isConnected && !isLoading) {
      // 3초 후에도 연결 안되면 에러 표시
      const timer = setTimeout(() => {
        if (!isConnected) {
          setSyncErrorModal(true);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, squad?.id, isLoading]);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>데이터 로드 중...</p>
      </div>
    );
  }

  return (
    <>
      <Layout />

      {/* 동기화 에러 모달 */}
      <AlertModal
        isOpen={syncErrorModal}
        message="⚠️ 실시간 동기화 연결 실패\n\n인터넷 연결을 확인해주세요.\n데이터는 로컬에 저장됩니다."
        onClose={() => setSyncErrorModal(false)}
      />

      {/* 초기 로드 에러 모달 */}
      {loadError && (
        <AlertModal
          isOpen={!!loadError}
          message={`❌ 데이터 로드 실패\n\n${loadError}\n\n인터넷 연결을 확인해주세요.`}
          onClose={() => {}}
        />
      )}
    </>
  );
};

export default App;
