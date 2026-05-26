import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initKakao } from './lib/kakaoShare'

initKakao();

// 카카오톡 공유 카드를 통해 들어온 초대 코드(?invite=CODE)를 localStorage에 보존.
// OAuth 로그인 흐름이나 페이지 리다이렉트 후에도 ClubSetupPage 에서 자동 입력되도록.
(() => {
  try {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite && invite.trim().length > 0) {
      localStorage.setItem('pendingInviteCode', invite.trim().toUpperCase());
    }
  } catch {
    /* localStorage 차단 환경(시크릿/3rd party 쿠키 차단)에서는 조용히 패스 */
  }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
