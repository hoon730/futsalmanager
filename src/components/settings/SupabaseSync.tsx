import { useState } from "react";
import { useSquadStore } from "@/stores/squadStore";
import { useFixedTeamStore } from "@/stores/fixedTeamStore";
import { useDivisionStore } from "@/stores/divisionStore";
import {
  syncAllDataToSupabase,
  loadAllDataFromSupabase,
  findSquadByName,
} from "@/lib/supabaseSync";
import { AlertModal, ConfirmModal } from "@/components/modals";

export const SupabaseSync = () => {
  const { squad, setSquad } = useSquadStore();
  const { fixedTeams } = useFixedTeamStore();
  const { divisionHistory, teammateHistory } = useDivisionStore();

  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  // Supabase에 업로드
  const handleUploadToSupabase = async () => {
    if (!squad) {
      setAlertMessage("스쿼드가 없습니다");
      setShowAlert(true);
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncAllDataToSupabase(
        squad,
        fixedTeams,
        divisionHistory,
        teammateHistory
      );

      if (result.success) {
        setAlertMessage("✅ Supabase에 업로드 완료!");
      } else {
        setAlertMessage("❌ 업로드 실패");
      }
      setShowAlert(true);
    } catch (error) {
      console.error("Upload error:", error);
      setAlertMessage("❌ 업로드 중 오류 발생");
      setShowAlert(true);
    } finally {
      setIsSyncing(false);
    }
  };

  // Supabase에서 다운로드
  const handleDownloadFromSupabase = async () => {
    if (!squad) {
      setAlertMessage("스쿼드가 없습니다");
      setShowAlert(true);
      return;
    }

    setConfirmMessage(
      `Supabase에서 "${squad.name}" 데이터를 가져오면 현재 로컬 데이터가 덮어씌워집니다. 계속하시겠습니까?`
    );
    setConfirmAction(() => async () => {
      setIsLoading(true);
      try {
        // 스쿼드 이름으로 검색
        const cloudSquad = await findSquadByName(squad.name);

        if (!cloudSquad) {
          setAlertMessage(`"${squad.name}" 스쿼드를 Supabase에서 찾을 수 없습니다`);
          setShowAlert(true);
          return;
        }

        // 전체 데이터 로드
        const data = await loadAllDataFromSupabase(cloudSquad.id);

        if (data.squad) {
          setSquad(data.squad);
          setAlertMessage("✅ Supabase에서 다운로드 완료!");
        } else {
          setAlertMessage("❌ 다운로드 실패");
        }
        setShowAlert(true);
      } catch (error) {
        console.error("Download error:", error);
        setAlertMessage("❌ 다운로드 중 오류 발생");
        setShowAlert(true);
      } finally {
        setIsLoading(false);
      }
    });
    setShowConfirm(true);
  };

  const executeConfirmAction = () => {
    if (confirmAction) {
      confirmAction();
      setConfirmAction(null);
    }
    setShowConfirm(false);
  };

  return (
    <>
      <section className="section">
        <h2>☁️ Supabase 동기화</h2>
        <p className="mb-4 text-sm text-gray-400">
          여러 기기에서 데이터를 공유하려면 Supabase에 동기화하세요
        </p>

        <div className="sync-info mb-4">
          <div className="info-row">
            <span className="label">스쿼드 이름:</span>
            <span className="value">{squad?.name || "없음"}</span>
          </div>
          <div className="info-row">
            <span className="label">멤버 수:</span>
            <span className="value">{squad?.members.length || 0}명</span>
          </div>
          <div className="info-row">
            <span className="label">이력 수:</span>
            <span className="value">{divisionHistory.length}개</span>
          </div>
        </div>

        <div className="sync-actions">
          <button
            className="btn-secondary"
            onClick={handleUploadToSupabase}
            disabled={isSyncing || !squad}
          >
            {isSyncing ? "업로드 중..." : "⬆️ 업로드"}
          </button>
          <button
            className="btn-secondary"
            onClick={handleDownloadFromSupabase}
            disabled={isLoading || !squad}
          >
            {isLoading ? "다운로드 중..." : "⬇️ 다운로드"}
          </button>
        </div>

        <div className="sync-help mt-4 p-3 rounded-lg bg-black/20">
          <p className="text-xs text-gray-400">
            💡 <strong>사용 방법:</strong>
          </p>
          <ul className="text-xs text-gray-400 mt-2 ml-4">
            <li>• 첫 번째 기기: "업로드" 클릭</li>
            <li>• 다른 기기: 같은 스쿼드 이름 입력 후 "다운로드" 클릭</li>
            <li>• 데이터가 실시간으로 공유됩니다</li>
          </ul>
        </div>
      </section>

      <AlertModal
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        message={alertMessage}
      />

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={executeConfirmAction}
        title="데이터 덮어쓰기 확인"
        message={confirmMessage}
        confirmText="다운로드"
      />
    </>
  );
};
