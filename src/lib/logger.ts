// 개발 환경에서만 출력되는 통합 로거.
// - vite.config.ts 의 esbuild.drop: ["console"] 가 프로덕션 빌드에서
//   console.* 호출을 제거하므로 이 wrapper 도 자연스레 침묵.
// - 진입점이 하나가 되면 추후 Sentry / Datadog 같은 외부 reporter 를
//   error 분기에 끼워넣기 쉬워진다.
const isDev = import.meta.env.DEV;

export const logger = {
  log:   (...args: unknown[]) => { if (isDev) console.log(...args); },
  info:  (...args: unknown[]) => { if (isDev) console.info(...args); },
  warn:  (...args: unknown[]) => { if (isDev) console.warn(...args); },
  error: (...args: unknown[]) => { if (isDev) console.error(...args); },
};
