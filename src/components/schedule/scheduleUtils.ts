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
