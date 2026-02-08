import Layout from "@/components/Layout";
import { useInitialLoad } from "@/hooks/useInitialLoad";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useAutoSync } from "@/hooks/useAutoSync";
import { useSquadStore } from "@/stores/squadStore";

const App = () => {
  const { isLoading } = useInitialLoad();
  const { squad } = useSquadStore();
  const { isConnected } = useRealtimeSync(squad?.id || null);

  // 자동 동기화 활성화
  useAutoSync();

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
      {isConnected && (
        <div className="sync-indicator">
          🟢 실시간 동기화 중
        </div>
      )}
      <Layout isConnected={isConnected} />
    </>
  );
};

export default App;
