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
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    // 1단계: onAuthStateChange를 먼저 등록 (OAuth PKCE 콜백 이벤트 유실 방지)
    //
    // 카카오 등 OAuth PKCE 방식은 ?code= → 토큰 교환이 비동기이므로
    // getSession() await 중에 SIGNED_IN이 발화해도 리스너가 없으면 유실됨.
    // 리스너를 먼저 등록해 모든 이벤트를 놓치지 않는다.
    supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        // 세션 없음 또는 로그아웃
        if (event === "SIGNED_OUT" || !session?.user) {
          set({ user: null, session: null, profile: null, isLoading: false });
          return;
        }

        // 토큰 갱신 / 유저 메타 업데이트 — profile 재조회 불필요
        // isLoading: false도 함께 설정 (TOKEN_REFRESHED가 INITIAL_SESSION보다 먼저 오는 edge case 대응)
        if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          set({ user: session.user, session, isLoading: false });
          return;
        }

        // INITIAL_SESSION(기존 세션 복원 또는 OAuth 콜백) / SIGNED_IN
        let { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        // OAuth 신규 유저 자동 프로필 생성 (SIGNED_IN 시에만)
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

        set({ user: session.user, session, profile, isLoading: false });
      } catch {
        // 예외 발생 시에도 반드시 로딩 해제 (무한 로딩 방지)
        set((state) => ({ ...state, isLoading: false }));
      }
    });

    // 2단계: getSession()을 안전망으로 호출
    //
    // 개발 환경 React Strict Mode, HMR, 또는 Supabase 내부 AbortError로
    // INITIAL_SESSION 이벤트가 누락될 수 있음. 이 경우 isLoading이 영원히 true.
    // getSession()으로 현재 세션을 직접 확인해 무한 로딩을 방지한다.
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // INITIAL_SESSION이 이미 처리됐으면 종료 (isLoading이 false로 바뀐 경우)
      if (!get().isLoading) return;

      if (!session?.user) {
        set({ user: null, session: null, profile: null, isLoading: false });
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
    } catch {
      // getSession 자체가 실패해도 로딩 해제
      if (get().isLoading) {
        set((state) => ({ ...state, isLoading: false }));
      }
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
