import { create } from "zustand";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

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
          .single();
        set({ user: session.user, session, profile, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }

    // 세션 변경 감지
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        let { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        // 카카오 등 OAuth 신규 유저 → 프로필 자동 생성
        if (!profile) {
          const defaultUsername =
            (session.user.user_metadata?.name as string) ||
            (session.user.user_metadata?.full_name as string) ||
            session.user.email?.split("@")[0] ||
            "사용자";
          await supabase.from("profiles").upsert({ id: session.user.id, username: defaultUsername });
          const { data: created } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();
          profile = created;
        }

        set({ user: session.user, session, profile });
      } else {
        set({ user: null, session: null, profile: null });
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
      const message = err instanceof Error ? err.message : "회원가입 실패";
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
      const message = err instanceof Error ? err.message : "로그인 실패";
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
