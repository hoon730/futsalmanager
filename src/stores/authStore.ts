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
    // onAuthStateChange를 getSession()보다 먼저 등록한다.
    //
    // 이유: 카카오 등 OAuth PKCE 방식은 ?code= 를 토큰으로 교환하는 작업이 비동기다.
    // 이전 코드는 "await getSession() → onAuthStateChange 등록" 순서였는데,
    // getSession()을 기다리는 동안 교환이 완료되어 SIGNED_IN 이벤트가 발화해도
    // 리스너가 아직 없어서 이벤트가 유실됐다.
    // 결과: user=null, isLoading=false → 로그인 직후 앱이 빈 화면만 표시.
    //
    // 수정: 리스너를 먼저 등록하고 INITIAL_SESSION(기존 세션 복원 + OAuth 콜백 완료)까지
    // 처리하면 모든 경우를 놓치지 않는다. getSession() 별도 호출 불필요.
    supabase.auth.onAuthStateChange(async (event, session) => {
      // 세션 없음 또는 로그아웃
      if (event === "SIGNED_OUT" || !session?.user) {
        set({ user: null, session: null, profile: null, isLoading: false });
        return;
      }

      // 토큰 갱신 / 유저 메타 업데이트 — profile 재조회 불필요
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        set({ user: session.user, session });
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
    });
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
