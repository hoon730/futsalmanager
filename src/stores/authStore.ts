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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();
        set({ user: session.user, session, profile, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }

    // 세션 변경 감지
    // INITIAL_SESSION은 initialize()가 이미 처리했으므로 스킵.
    // TOKEN_REFRESHED/USER_UPDATED는 user/session만 갱신하고 profile은 재조회 안 함.
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "INITIAL_SESSION") return;

      if (event === "SIGNED_OUT" || !session?.user) {
        set({ user: null, session: null, profile: null });
        return;
      }

      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        set({ user: session.user, session });
        return;
      }

      // SIGNED_IN: 프로필 조회 + (없으면) OAuth 신규 유저용 자동 생성
      if (event === "SIGNED_IN") {
        let { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!profile) {
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

        set({ user: session.user, session, profile });
      }
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
    const { data: { user: currentUser } } = await supabase.auth.getUser();
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
