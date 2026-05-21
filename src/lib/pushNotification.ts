import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

// 서비스 워커 미등록 시 navigator.serviceWorker.ready가 영원히 pending됨.
// dev 빌드나 SW 등록 실패 환경에서 토글이 무한 로딩에 빠지는 걸 막기 위해 timeout 추가.
const SW_READY_TIMEOUT_MS = 5000;

async function waitForServiceWorker(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('서비스 워커 준비 시간 초과 (5초)')),
        SW_READY_TIMEOUT_MS
      )
    ),
  ]);
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const arr = Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  return arr.buffer as ArrayBuffer;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  return Notification.requestPermission();
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await waitForServiceWorker();
    return reg.pushManager.getSubscription();
  } catch {
    // SW가 준비되지 않은 환경 → 구독 없음으로 처리 (토글 활성 상태에 영향 X)
    return null;
  }
}

export async function subscribeToPush(
  squadId: string,
  userId: string
): Promise<PushSubscription> {
  if (!isPushSupported()) throw new Error('Push not supported');
  if (!VAPID_PUBLIC_KEY) throw new Error('VITE_VAPID_PUBLIC_KEY is not set');

  const reg = await waitForServiceWorker();
  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      squad_id: squadId,
      subscription: sub.toJSON(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,squad_id' }
  );

  if (error) throw error;
  return sub;
}

export async function unsubscribeFromPush(
  squadId: string,
  userId: string
): Promise<void> {
  if (!isPushSupported()) return;

  try {
    const reg = await waitForServiceWorker();
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch {
    // SW가 준비되지 않았어도 DB의 구독 행은 정리해야 함 → 계속 진행
  }

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('squad_id', squadId);
}
