import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Supabase 서버는 OAuth를 항상 PKCE로 처리하므로 클라이언트도 PKCE로 맞춰야 함.
    // 기본값 'implicit'으로 두면:
    //   1) signInWithOAuth가 code_challenge를 URL에 넣지 않고 code_verifier를 localStorage에 저장하지 않음
    //   2) Supabase 서버는 ?code= 로 콜백 (PKCE 형식)
    //   3) 클라이언트의 _isPKCECallback은 localStorage에 code-verifier가 없어서 false → URL 처리 안 함
    //   4) 결과: 세션이 저장되지 않음 → 새로고침 시 로그인 페이지로 돌아감
    //   5) ?code= 가 URL에 남아 있으면 Supabase 내부 lock이 풀리지 않아 이후 signInWithPassword도 무한 대기
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
