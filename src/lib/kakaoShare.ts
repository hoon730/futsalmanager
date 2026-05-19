// Kakao JavaScript SDK 기반 카카오톡 공유
// 비즈니스 인증 없이 사용 가능한 Share 기능만 다룸

// SDK는 index.html에서 로드됨 — 전역 window.Kakao 객체 사용
interface KakaoLink {
  title: string;
  description: string;
  imageUrl: string;
  link: { mobileWebUrl: string; webUrl: string };
}

interface KakaoButton {
  title: string;
  link: { mobileWebUrl: string; webUrl: string };
}

interface KakaoShareParams {
  objectType: "feed";
  content: KakaoLink;
  buttons?: KakaoButton[];
}

interface KakaoGlobal {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: { sendDefault: (params: KakaoShareParams) => void };
}

declare global {
  interface Window {
    Kakao?: KakaoGlobal;
  }
}

/** SDK 초기화 — main.tsx에서 1회 호출 */
export function initKakao() {
  const key = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
  if (!key) return; // 키 미설정 시 조용히 패스 (개발 환경)
  if (!window.Kakao) return;
  if (window.Kakao.isInitialized()) return;
  window.Kakao.init(key);
}

/** 카톡 공유 사용 가능 여부 */
export function isKakaoReady(): boolean {
  return Boolean(window.Kakao?.isInitialized());
}

/** 동호회 초대 코드 공유 */
export function shareSquadInvite(squadName: string, inviteCode: string) {
  if (!isKakaoReady()) {
    alert("카카오 공유를 사용할 수 없습니다");
    return;
  }
  const baseUrl = window.location.origin;
  const url = `${baseUrl}?invite=${encodeURIComponent(inviteCode)}`;
  window.Kakao!.Share.sendDefault({
    objectType: "feed",
    content: {
      title: `[${squadName}] 동호회 초대`,
      // 카드 본문에 코드 + 입장 URL 명시 → 길게 눌러 복사 가능 & 직접 접속 안내
      description:
        `초대 코드: ${inviteCode}\n` +
        `\n👇 아래 버튼을 누르면 자동으로 가입 페이지로 이동합니다.\n` +
        `또는 ${baseUrl} 에 접속해서 "동호회 참가" → 코드 입력`,
      imageUrl: `${baseUrl}/og-image.png`,
      link: { mobileWebUrl: url, webUrl: url },
    },
    buttons: [{ title: "동호회 가입하기", link: { mobileWebUrl: url, webUrl: url } }],
  });
}

/** 경기 일정 공유 */
export function shareMatch(opts: {
  title: string;
  matchDate: string;
  location?: string;
  attendingCount: number;
  maxPlayers: number;
}) {
  if (!isKakaoReady()) {
    alert("카카오 공유를 사용할 수 없습니다");
    return;
  }
  const baseUrl = window.location.origin;
  const date = new Date(opts.matchDate);
  const dateStr = date.toLocaleString("ko-KR", {
    month: "long", day: "numeric", weekday: "short",
    hour: "2-digit", minute: "2-digit",
  });
  const desc = [
    dateStr,
    opts.location && `📍 ${opts.location}`,
    `참석 ${opts.attendingCount}/${opts.maxPlayers}명`,
  ].filter(Boolean).join(" · ");
  window.Kakao!.Share.sendDefault({
    objectType: "feed",
    content: {
      title: opts.title,
      description: desc,
      imageUrl: `${baseUrl}/og-image.png`,
      link: { mobileWebUrl: baseUrl, webUrl: baseUrl },
    },
    buttons: [{ title: "참석 응답하기", link: { mobileWebUrl: baseUrl, webUrl: baseUrl } }],
  });
}
