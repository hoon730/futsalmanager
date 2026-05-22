import { lazy, type ComponentType } from "react";

/**
 * 새 배포 후 stale chunk 자동 복구
 *
 * 문제: 이전 빌드의 index.html을 로드한 사용자가 lazy chunk를 처음 fetch할 때,
 * 그 청크 해시는 새 배포에서 더 이상 존재하지 않아 404가 나면서 페이지 전환이 실패함.
 *
 * 1차 방어: chunk fetch가 실패하면 sessionStorage 플래그로 무한 루프를 방지하면서
 * 페이지를 한 번 reload → 새 index.html을 받아 새 청크 해시로 다시 시도.
 * 2차 방어: reload 후에도 실패하면 ChunkLoadError를 그대로 던져
 * ChunkErrorBoundary에서 안내 UI로 잡음.
 *
 * 플래그는 App 마운트 시 clearChunkReloadFlag()로 정리하므로 다음 배포에서도
 * 같은 복구가 동작함.
 */
const RELOAD_FLAG = "chunkReloadedAt";

export class ChunkLoadError extends Error {
  constructor(message = "청크 로드 실패") {
    super(message);
    this.name = "ChunkLoadError";
  }
}

export function clearChunkReloadFlag() {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* private mode 등 */
  }
}

export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof ChunkLoadError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";
  return (
    name === "ChunkLoadError" ||
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Loading chunk") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module")
  );
}

// React의 원래 lazy 시그니처와 동일하게 ComponentType<any>를 사용 — props가 있는
// 페이지 컴포넌트(SchedulePage 등)도 받을 수 있도록.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (!isChunkLoadError(err)) throw err;

      const alreadyReloaded = (() => {
        try {
          return sessionStorage.getItem(RELOAD_FLAG);
        } catch {
          return null;
        }
      })();

      if (alreadyReloaded) {
        // 이미 한 번 reload 했는데도 같은 에러 → ErrorBoundary로 넘김
        throw new ChunkLoadError(
          "새 버전을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        );
      }

      try {
        sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
      } catch {
        /* ignore */
      }
      window.location.reload();
      // reload 중에는 컴포넌트가 mount되면 안 됨 → 영영 resolve 안 하는 promise
      return new Promise<{ default: T }>(() => {});
    }
  });
}
