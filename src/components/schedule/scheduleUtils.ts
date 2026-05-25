// 일정 페이지 공용 유틸리티

export const STATUS_CONFIG = {
  attending: { label: "참석", color: "#0DF23E", textColor: "#0a150d", dimBg: "rgba(13,242,62,0.10)" },
  absent:    { label: "불참", color: "#ef4444", textColor: "#ffffff",  dimBg: "rgba(239,68,68,0.10)" },
  pending:   { label: "보류", color: "#f59e0b", textColor: "#0a150d", dimBg: "rgba(245,158,11,0.10)" },
  waitlist:  { label: "대기", color: "#f97316", textColor: "#ffffff",  dimBg: "rgba(249,115,22,0.10)" },
} as const;

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export function getDDay(matchDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const match = new Date(matchDate);
  match.setHours(0, 0, 0, 0);
  const diff = Math.floor((match.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "D-Day";
  return `D-${diff}`;
}

/**
 * 참가 신청 마감 정보 계산.
 * - 마감 시각이 없으면 hasDeadline: false (제약 없음)
 * - 마감 시각이 지났으면 isClosed: true
 * - 남은 시간을 한국어 라벨로 변환
 */
export function getRsvpInfo(rsvpDeadline?: string | null): {
  hasDeadline: boolean;
  isClosed: boolean;
  remainingMs: number;
  label: string;
} {
  if (!rsvpDeadline) {
    return { hasDeadline: false, isClosed: false, remainingMs: 0, label: "" };
  }
  const deadlineMs = new Date(rsvpDeadline).getTime();
  const remainingMs = deadlineMs - Date.now();
  const isClosed = remainingMs <= 0;

  if (isClosed) return { hasDeadline: true, isClosed: true, remainingMs, label: "참가 마감됨" };

  const minutes = Math.floor(remainingMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  let label: string;
  if (days >= 1) label = `참가 마감 ${days}일 전`;
  else if (hours >= 1) label = `참가 마감 ${hours}시간 전`;
  else label = `참가 마감 ${Math.max(minutes, 1)}분 전`;
  return { hasDeadline: true, isClosed: false, remainingMs, label };
}

/**
 * "경기 시각 N시간 전" → ISO 타임스탬프 변환.
 * hoursBefore <= 0 이면 null (마감 없음)
 */
export function computeRsvpDeadline(matchDateIso: string, hoursBefore: number): string | null {
  if (!matchDateIso || hoursBefore <= 0) return null;
  const matchMs = new Date(matchDateIso).getTime();
  if (Number.isNaN(matchMs)) return null;
  return new Date(matchMs - hoursBefore * 3600 * 1000).toISOString();
}

/**
 * 기존 ISO 마감 시각을 "경기 N시간 전" 형태로 역산 (수정 모드 초기값용).
 * 매핑되지 않는 값은 0 반환 ("마감 없음").
 */
export function deadlineToHoursBefore(matchDateIso: string, rsvpDeadline?: string | null): number {
  if (!rsvpDeadline) return 0;
  const matchMs = new Date(matchDateIso).getTime();
  const deadlineMs = new Date(rsvpDeadline).getTime();
  if (Number.isNaN(matchMs) || Number.isNaN(deadlineMs)) return 0;
  const diffHours = Math.round((matchMs - deadlineMs) / (3600 * 1000));
  return diffHours > 0 ? diffHours : 0;
}

/**
 * 매치 자동 제목 생성 — "5.25 (월) 19:00 경기" 형식.
 * MatchFormModal 에서 사용자가 직접 입력하지 않으므로 시각 기반으로 자동 생성.
 * 표시 측(MatchDetailSheet 등)에서 빈 title fallback 과 일치하는 포맷 유지.
 */
export function defaultMatchTitle(matchDateIso: string): string {
  const d = new Date(matchDateIso);
  if (Number.isNaN(d.getTime())) return "경기";
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = d.toLocaleDateString("ko-KR", { weekday: "short" });
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${month}.${day} (${weekday}) ${hh}:${mm} 경기`;
}
