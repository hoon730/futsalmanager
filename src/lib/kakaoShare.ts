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
      description: `초대 코드: ${inviteCode}\n앱에서 코드를 입력하면 동호회에 참가할 수 있습니다.`,
      imageUrl: `${baseUrl}/og-image.svg`,
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
      imageUrl: `${baseUrl}/og-image.svg`,
      link: { mobileWebUrl: baseUrl, webUrl: baseUrl },
    },
    buttons: [{ title: "참석 응답하기", link: { mobileWebUrl: baseUrl, webUrl: baseUrl } }],
  });
}
