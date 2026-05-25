/**
 * Supabase / 일반 에러 → 한국어 메시지로 변환.
 * 화이트리스트되지 않은 영문 메시지는 fallback 문구로 대체.
 */
export function toFriendlyMessage(err: unknown, fallback = "요청에 실패했습니다"): string {
  if (!err) return fallback;
  const raw = err instanceof Error ? err.message : String(err);

  // 1. 이미 한국어가 섞인 메시지는 그대로 (RPC가 한국어로 throw하는 경우 등)
  if (/[가-힣]/.test(raw)) return raw;

  // 2. 자주 보이는 Supabase/Postgres 영문 패턴 화이트리스트
  const map: { test: RegExp; msg: string }[] = [
    { test: /duplicate key|already exists|unique_violation/i, msg: "이미 등록된 항목입니다" },
    { test: /violates foreign key/i, msg: "연결된 데이터가 없어 처리할 수 없습니다" },
    { test: /violates not-null/i, msg: "필수 항목이 비어 있습니다" },
    { test: /permission denied|new row violates row-level security/i, msg: "권한이 없습니다" },
    { test: /JWT|jwt expired|invalid token|missing token/i, msg: "다시 로그인해주세요" },
    { test: /network|fetch failed|failed to fetch/i, msg: "네트워크 연결을 확인해주세요" },
    { test: /Invalid login credentials/i, msg: "이메일 또는 비밀번호가 올바르지 않습니다" },
    { test: /User already registered/i, msg: "이미 가입된 이메일입니다" },
    { test: /Password should be at least/i, msg: "비밀번호가 너무 짧습니다" },
    { test: /Email not confirmed/i, msg: "이메일 인증이 필요합니다" },
    { test: /rate limit exceeded/i, msg: "시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요" },
  ];

  for (const { test, msg } of map) {
    if (test.test(raw)) return msg;
  }

  // 3. 알 수 없는 영문 메시지는 fallback
  return fallback;
}
