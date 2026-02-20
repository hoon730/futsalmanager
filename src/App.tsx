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

  // 동기화 연결 실패 감지 - 데이터가 없을 때만, 최초 연결 실패 시에만 표시
  const hasData = (squad?.members?.length ?? 0) > 0;
  useEffect(() => {
    // 이미 연결됐거나, 데이터가 있거나, 로딩 중이면 모달 표시 안 함
    if (isConnected || hasData || isLoading || !squad?.id) return;

    const timer = setTimeout(() => {
      // 타이머 만료 시점에 다시 체크: 여전히 미연결이고 데이터도 없을 때만
      if (!isConnected && !hasData) {
        setSyncErrorModal(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isConnected, squad?.id, isLoading, hasData]);

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
