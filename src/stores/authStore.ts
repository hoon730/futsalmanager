import { create } from "zustand";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { toFriendlyMessage } from "@/lib/errorMessage";

interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithKakao: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  updateLinkedMember: (memberId: string | null) => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
  linkKakao: () => Promise<void>;
}

// React Strict Mode의 double-invoke로 인해 initialize()가 두 번 호출될 수 있음.
// 이전 onAuthStateChange 구독을 반드시 해제한 뒤 새로 등록해 리스너 중복을 방지한다.
let _authSubscription: { unsubscribe: () => void } | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    // ?error= 파라미터만 즉시 제거 (bad_oauth_state 등 OAuth 실패 리다이렉트 결과)
    // ?code= 는 건드리지 않음 — Supabase가 createClient() 이후 비동기로 읽어 PKCE 교환하기 때문.
    // ?code= 를 먼저 제거하면 Supabase 내부 lock이 해소되지 않아 이후 auth 호출이 무한 대기함.
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("error")) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    }

    // 안전망 타이머: getSession()이 hang하는 경우 5초 후 강제로 로딩 해제
    // (네트워크 응답 없음 + 에러도 없는 상황 → catch가 실행되지 않아 무한 로딩 발생)
    const safetyTimer = setTimeout(() => {
      if (get().isLoading) {
        set((state) => ({ ...state, isLoading: false }));
      }
    }, 5000);

    // 1단계: 이전 구독 해제 후 onAuthStateChange 등록 (리스너 중복 방지)
    //
    // 카카오 등 OAuth PKCE 방식은 ?code= → 토큰 교환이 비동기이므로
    // getSession() await 중에 SIGNED_IN이 발화해도 리스너가 없으면 유실됨.
    // 리스너를 먼저 등록해 모든 이벤트를 놓치지 않는다.
    _authSubscription?.unsubscribe();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // ⚠️ 중요: 이 콜백은 동기적으로 빠르게 반환해야 한다.
      //
      // Supabase _notifyAllSubscribers는 모든 콜백을 await Promise.all 로 기다림.
      //   - signInWithPassword / signInWithOAuth / 토큰 갱신 등이 모두 이 콜백이 끝날 때까지 hang
      //   - 콜백 안에서 supabase.from("profiles") 같은 쿼리를 await하면
      //     해당 쿼리가 RLS / 네트워크 / 세션 락 등으로 hang할 때 로그인 전체가 hang됨
      //     → "POST /token 200 OK 인데 로그인 무한 로딩" 증상의 근본 원인
      //
      // → user/session 은 즉시 set하고, profile 조회는 비동기로 분리 (await 하지 않음)
      try {
        if (event === "SIGNED_OUT" || !session?.user) {
          set({ user: null, session: null, profile: null, isLoading: false });
          return;
        }

        // user/session/isLoading 은 즉시 반영 — Auth state 갱신은 절대 block되지 않음
        set((state) => ({
          ...state,
          user: session.user,
          session,
          isLoading: false,
          // TOKEN_REFRESHED / USER_UPDATED 일 때는 기존 profile 유지
          profile: (event === "TOKEN_REFRESHED" || event === "USER_UPDATED")
            ? state.profile
            : state.profile, // INITIAL_SESSION / SIGNED_IN 도 일단 기존 값으로 — 아래에서 background 갱신
        }));

        // TOKEN_REFRESHED / USER_UPDATED 는 profile 재조회 불필요
        if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;

        // INITIAL_SESSION / SIGNED_IN: ?code= 제거 + profile background fetch
        if (typeof window !== "undefined" && window.location.search.includes("code=")) {
          window.history.replaceState({}, "", window.location.pathname);
        }

        // ⬇️ 의도적으로 await 하지 않음 — auth flow를 block하지 않기 위해
        void (async () => {
          try {
            let { data: profile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .maybeSingle();

            if (!profile && event === "SIGNED_IN") {
              const defaultUsername =
                (session.user.user_metadata?.name as string) ||
                (session.user.user_metadata?.full_name as string) ||
                session.user.email?.split("@")[0] ||
                "사용자";
              const { data: upserted } = await supabase
                .from("profiles")
                .upsert({ id: session.user.id, username: defaultUsername })
                .select()
                .single();
              profile = upserted;
            }

            if (profile) set((state) => ({ ...state, profile }));
          } catch (e) {
            console.error("프로필 조회 실패 (auth state는 정상):", e);
          }
        })();
      } catch {
        set((state) => ({ ...state, isLoading: false }));
      }
    });
    _authSubscription = subscription;

    // 2단계: getSession()을 안전망으로 호출
    //
    // 개발 환경 React Strict Mode, HMR, 또는 Supabase 내부 AbortError로
    // INITIAL_SESSION 이벤트가 누락될 수 있음. 이 경우 isLoading이 영원히 true.
    // getSession()으로 현재 세션을 직접 확인해 무한 로딩을 방지한다.
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // INITIAL_SESSION이 이미 처리됐으면 종료 (isLoading이 false로 바뀐 경우)
      if (!get().isLoading) { clearTimeout(safetyTimer); return; }

      if (!session?.user) {
        set({ user: null, session: null, profile: null, isLoading: false });
        clearTimeout(safetyTimer);
        return;
      }

      // 세션이 있는데 INITIAL_SESSION이 아직 처리되지 않은 경우: 직접 처리
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (get().isLoading) {
        set({ user: session.user, session, profile, isLoading: false });
      }
      clearTimeout(safetyTimer);
    } catch {
      // getSession 자체가 실패해도 로딩 해제
      if (get().isLoading) {
        set((state) => ({ ...state, isLoading: false }));
      }
      clearTimeout(safetyTimer);
    }
  },

  signUp: async (email, password, username) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          username,
        });
      }
    } catch (err: unknown) {
      const message = toFriendlyMessage(err, "회원가입에 실패했습니다");
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: unknown) {
      const message = toFriendlyMessage(err, "로그인에 실패했습니다");
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  signInWithKakao: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: window.location.origin,
        scopes: "profile_nickname profile_image account_email",
      },
    });
    if (error) throw error;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null });
  },

  clearError: () => set({ error: null }),

  updateLinkedMember: async (memberId) => {
    // 1. RPC로 DB 레벨 1:1 연결 강제 (중복 연결 시 23505 예외)
    if (memberId) {
      const { error: rpcError } = await supabase.rpc("link_my_member", { p_member_id: memberId });
      if (rpcError) throw rpcError;
    } else {
      const { error: rpcError } = await supabase.rpc("unlink_my_member");
      if (rpcError) throw rpcError;
    }

    // 2. RPC 성공 시에만 user_metadata 동기화 (클라이언트 측 조회용)
    const { data, error } = await supabase.auth.updateUser({
      data: { member_id: memberId },
    });
    if (error) throw error;
    if (data.user) {
      set((state) => ({ user: data.user, session: state.session }));
    }
  },

  linkKakao: async () => {
    const { error } = await supabase.auth.linkIdentity({
      provider: "kakao",
      options: {
        redirectTo: window.location.origin,
        scopes: "profile_nickname profile_image account_email",
      },
    });
    if (error) throw error;
  },

  updateUsername: async (username) => {
    const trimmed = username.trim();
    if (!trimmed) throw new Error("닉네임을 입력해주세요");
    // 스토어의 user를 직접 사용 (supabase.auth.getUser() 네트워크 호출 제거)
    // 기존엔 getUser()가 네트워크 검증을 기다리느라 저장이 늦거나 hang 가능성이 있었음
    const currentUser = get().user;
    if (!currentUser) throw new Error("로그인이 필요합니다");
    const { data, error } = await supabase
      .from("profiles")
      .update({ username: trimmed })
      .eq("id", currentUser.id)
      .select()
      .single();
    if (error) throw error;
    set((state) => ({ profile: state.profile ? { ...state.profile, username: data.username } : data }));
  },
}));
