import { useSquadStore } from "@/stores/squadStore";
import { useDivisionStore } from "@/stores/divisionStore";

interface Props {
  isConnected: boolean;
}

export const SupabaseSync = ({ isConnected }: Props) => {
  const { squad } = useSquadStore();
  const { divisionHistory } = useDivisionStore();

  return (
    <section className="section">
      <h2>☁️ 실시간 동기화</h2>
      <p className="mb-4 text-sm text-gray-400">
        모든 데이터가 자동으로 동기화됩니다
      </p>

      <div className="sync-status mb-4 p-4 rounded-lg" style={{
        background: isConnected
          ? 'linear-gradient(135deg, rgba(0, 255, 65, 0.1), rgba(0, 255, 65, 0.05))'
          : 'linear-gradient(135deg, rgba(255, 107, 107, 0.1), rgba(255, 107, 107, 0.05))',
        border: `1px solid ${isConnected ? 'rgba(0, 255, 65, 0.3)' : 'rgba(255, 107, 107, 0.3)'}`
      }}>
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}
               style={{
                 boxShadow: isConnected
                   ? '0 0 10px rgba(0, 255, 65, 0.5)'
                   : '0 0 10px rgba(255, 107, 107, 0.5)'
               }} />
          <span className="font-semibold">
            {isConnected ? '🟢 연결됨' : '🔴 연결 끊김'}
          </span>
        </div>

        <div className="text-sm text-gray-300 space-y-1">
          <div>스쿼드: <strong>{squad?.name || '없음'}</strong></div>
          <div>멤버: <strong>{squad?.members.length || 0}명</strong></div>
          <div>이력: <strong>{divisionHistory.length}개</strong></div>
        </div>
      </div>

      <div className="sync-help p-3 rounded-lg bg-black/20">
        <p className="text-xs text-gray-400 mb-2">
          ✨ <strong>자동 동기화 기능:</strong>
        </p>
        <ul className="text-xs text-gray-400 space-y-1 ml-4">
          <li>• 멤버 추가/삭제 시 모든 기기에 즉시 반영</li>
          <li>• 팀 나누기 결과 자동 공유</li>
          <li>• 출석 이력 실시간 업데이트</li>
          <li>• 별도의 업로드/다운로드 불필요</li>
        </ul>
      </div>
    </section>
  );
};
