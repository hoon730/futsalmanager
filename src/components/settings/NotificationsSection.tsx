// 경기 알림 설정 카드. SettingsPage 에서 분리.
// - isPushSupported() 가 false 면 아예 렌더 안 함
// - 권한/구독 상태는 컴포넌트 내부에서 관리
import { useEffect, useState } from "react";
import {
  isPushSupported,
  getPermission,
  requestPermission,
  getCurrentSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/pushNotification";
import { toast } from "@/stores/toastStore";

interface Props {
  userId: string | null;
  squadId: string | null;
}

export function NotificationsSection({ userId, squadId }: Props) {
  const supported = isPushSupported();
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    if (!supported) return;
    setNotifPermission(getPermission());
    getCurrentSubscription().then((sub) => setIsSubscribed(!!sub));
  }, [supported]);

  const handleEnable = async () => {
    if (!userId || !squadId) return;
    setNotifLoading(true);
    try {
      const perm = await requestPermission();
      setNotifPermission(perm);
      if (perm === "granted") {
        await subscribeToPush(squadId, userId);
        setIsSubscribed(true);
        toast("경기 알림이 켜졌습니다");
      }
    } catch {
      toast("알림 설정에 실패했습니다", "error");
    } finally {
      setNotifLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!userId || !squadId) return;
    setNotifLoading(true);
    try {
      await unsubscribeFromPush(squadId, userId);
      setIsSubscribed(false);
      toast("알림이 해제되었습니다");
    } catch {
      toast("알림 해제에 실패했습니다", "error");
    } finally {
      setNotifLoading(false);
    }
  };

  if (!supported) return null;

  return (
    <div className="px-6 mb-6">
      <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3">경기 알림</p>

        {notifPermission === "denied" ? (
          <div className="flex items-center gap-3">
            <span className="material-icons text-white/20 text-sm" aria-hidden="true">notifications_off</span>
            <div className="flex-1">
              <p className="text-white/50 text-xs font-bold">브라우저에서 알림이 차단됨</p>
              <p className="text-white/20 text-[10px] mt-0.5">브라우저 설정에서 알림을 허용해주세요</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span
                className="material-icons text-sm flex-shrink-0"
                aria-hidden="true"
                style={{ color: isSubscribed ? "#0DF23E" : "rgba(255,255,255,0.2)" }}
              >
                {isSubscribed ? "notifications_active" : "notifications_none"}
              </span>
              <div className="min-w-0">
                <p className="text-white/70 text-sm font-bold">새 경기 알림</p>
                <p className="text-white/30 text-[10px] mt-0.5 truncate">
                  {isSubscribed ? "경기가 추가되면 알림을 받습니다" : "경기 추가 시 알림 받기"}
                </p>
              </div>
            </div>
            {/* 토글 스위치 */}
            <button
              onClick={isSubscribed ? handleDisable : handleEnable}
              disabled={notifLoading}
              aria-label={isSubscribed ? "경기 알림 끄기" : "경기 알림 켜기"}
              aria-pressed={isSubscribed}
              className="relative w-12 h-6 rounded-full transition-all duration-200 flex-shrink-0 disabled:opacity-50"
              style={{ backgroundColor: isSubscribed ? "#0DF23E" : "rgba(255,255,255,0.1)" }}
            >
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200"
                style={{ left: isSubscribed ? "1.375rem" : "0.125rem" }}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
