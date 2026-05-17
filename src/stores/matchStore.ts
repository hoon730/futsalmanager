import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { IMatch, IMatchAttendee, IMatchComment, IMember } from "@/types";

interface IMatchStore {
  matches: IMatch[];
  attendees: Record<string, IMatchAttendee[]>;
  comments: Record<string, IMatchComment[]>;
  matchMercenaries: Record<string, IMember[]>;
  isLoading: boolean;
  loadMatches: (squadId: string) => Promise<void>;
  createMatch: (squadId: string, data: Omit<IMatch, "id" | "createdAt" | "squadId">) => Promise<void>;
  deleteMatch: (matchId: string) => Promise<void>;
  loadAttendees: (matchId: string) => Promise<void>;
  setAttendance: (
    matchId: string,
    userId: string,
    status: "attending" | "absent" | "pending" | "waitlist",
    memberId?: string
  ) => Promise<void>;
  loadComments: (matchId: string) => Promise<void>;
  addComment: (
    matchId: string,
    userId: string,
    username: string,
    content: string,
    parentId?: string
  ) => Promise<void>;
  updateComment: (commentId: string, matchId: string, content: string) => Promise<void>;
  deleteComment: (commentId: string, matchId: string) => Promise<void>;
  setMatches: (matches: IMatch[]) => void;
  loadMercenaries: (matchId: string) => Promise<void>;
  addMatchMercenary: (matchId: string, name: string) => Promise<void>;
  removeMatchMercenary: (matchId: string, mercenaryId: string) => Promise<void>;
  updateMatch: (matchId: string, data: Partial<Omit<IMatch, "id" | "createdAt" | "squadId">>) => Promise<void>;
}

export const useMatchStore = create<IMatchStore>()((set, get) => ({
  matches: [],
  attendees: {},
  comments: {},
  matchMercenaries: {},
  isLoading: false,

  setMatches: (matches) => set({ matches }),

  loadMercenaries: async (matchId) => {
    const { data, error } = await supabase
      .from("match_mercenaries")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (error || !data) return;

    const mercenaries: IMember[] = data.map((m) => ({
      id: m.id,
      name: m.name,
      isMercenary: true,
      active: true,
      createdAt: m.created_at,
    }));

    set((state) => ({
      matchMercenaries: { ...state.matchMercenaries, [matchId]: mercenaries },
    }));
  },

  addMatchMercenary: async (matchId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = get().matchMercenaries[matchId] || [];
    if (current.some((m) => m.name === trimmed)) return;

    const { data, error } = await supabase
      .from("match_mercenaries")
      .insert({ match_id: matchId, name: trimmed })
      .select()
      .single();

    if (error) throw error;

    const newMerc: IMember = {
      id: data.id,
      name: data.name,
      isMercenary: true,
      active: true,
      createdAt: data.created_at,
    };

    set((state) => ({
      matchMercenaries: {
        ...state.matchMercenaries,
        [matchId]: [...(state.matchMercenaries[matchId] || []), newMerc],
      },
    }));
  },

  removeMatchMercenary: async (matchId, mercenaryId) => {
    const { error } = await supabase
      .from("match_mercenaries")
      .delete()
      .eq("id", mercenaryId);

    if (error) throw error;

    set((state) => ({
      matchMercenaries: {
        ...state.matchMercenaries,
        [matchId]: (state.matchMercenaries[matchId] || []).filter((m) => m.id !== mercenaryId),
      },
    }));
  },

  updateMatch: async (matchId, data) => {
    const { error } = await supabase
      .from("matches")
      .update({
        ...(data.title !== undefined && { title: data.title }),
        ...(data.matchDate !== undefined && { match_date: data.matchDate }),
        ...(data.location !== undefined && { location: data.location || null }),
        ...(data.maxPlayers !== undefined && { max_players: data.maxPlayers }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.rsvpDeadline !== undefined && { rsvp_deadline: data.rsvpDeadline || null }),
      })
      .eq("id", matchId);
    if (error) throw error;
    set((state) => ({
      matches: state.matches
        .map((m) => (m.id === matchId ? { ...m, ...data } : m))
        .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()),
    }));
  },

  loadMatches: async (squadId) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("squad_id", squadId)
        .order("match_date", { ascending: true });

      if (error) throw error;

      const matches: IMatch[] = (data || []).map((m) => ({
        id: m.id,
        squadId: m.squad_id,
        title: m.title,
        matchDate: m.match_date,
        location: m.location,
        maxPlayers: m.max_players,
        notes: m.notes,
        createdBy: m.created_by,
        createdAt: m.created_at,
        rsvpDeadline: m.rsvp_deadline ?? undefined,
      }));

      set({ matches });
    } catch (e) {
      console.error("경기 로드 실패:", e);
    } finally {
      set({ isLoading: false });
    }
  },

  createMatch: async (squadId, data) => {
    const { data: created, error } = await supabase
      .from("matches")
      .insert({
        squad_id: squadId,
        title: data.title,
        match_date: data.matchDate,
        location: data.location,
        max_players: data.maxPlayers,
        notes: data.notes,
        created_by: data.createdBy,
        rsvp_deadline: data.rsvpDeadline ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    const newMatch: IMatch = {
      id: created.id,
      squadId: created.squad_id,
      title: created.title,
      matchDate: created.match_date,
      location: created.location,
      maxPlayers: created.max_players,
      notes: created.notes,
      createdBy: created.created_by,
      createdAt: created.created_at,
      rsvpDeadline: created.rsvp_deadline ?? undefined,
    };

    set((state) => ({
      matches: [...state.matches, newMatch].sort(
        (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()
      ),
    }));

    // 비동기로 푸시 알림 전송 (실패해도 경기 생성에 영향 없음)
    supabase.functions
      .invoke('send-match-notification', {
        body: {
          matchId: created.id,
          squadId,
          title: created.title,
          matchDate: created.match_date,
          location: created.location ?? null,
        },
      })
      .catch(() => { /* 알림 실패 무시 */ });
  },

  deleteMatch: async (matchId) => {
    const { error } = await supabase.from("matches").delete().eq("id", matchId);
    if (error) throw error;
    set((state) => ({
      matches: state.matches.filter((m) => m.id !== matchId),
    }));
  },

  loadAttendees: async (matchId) => {
    const { data, error } = await supabase
      .from("match_attendees")
      .select("*")
      .eq("match_id", matchId);

    if (error || !data) return;

    const userIds = [...new Set(data.map((a) => a.user_id))];
    let profileMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);
      profileMap = Object.fromEntries(
        (profiles || []).map((p) => [p.id, p.username ?? ""])
      );
    }

    const attendees: IMatchAttendee[] = data.map((a) => ({
      id: a.id,
      matchId: a.match_id,
      userId: a.user_id,
      memberId: a.member_id,
      status: a.status,
      registeredAt: a.registered_at,
      username: profileMap[a.user_id] || undefined,
    }));

    set((state) => ({
      attendees: { ...state.attendees, [matchId]: attendees },
    }));
  },

  setAttendance: async (matchId, userId, status, memberId) => {
    const current = get().attendees[matchId] || [];
    const existing = current.find((a) => a.userId === userId);

    if (existing) {
      if (existing.status === status) return;

      set((state) => ({
        attendees: {
          ...state.attendees,
          [matchId]: current.map((a) =>
            a.userId === userId
              ? { ...a, status, ...(memberId !== undefined ? { memberId } : {}) }
              : a
          ),
        },
      }));

      const { error } = await supabase
        .from("match_attendees")
        .update({
          status,
          ...(memberId !== undefined ? { member_id: memberId } : {}),
        })
        .eq("match_id", matchId)
        .eq("user_id", userId);

      if (error) {
        set((state) => ({
          attendees: { ...state.attendees, [matchId]: current },
        }));
        throw error;
      }
    } else {
      const { data, error } = await supabase
        .from("match_attendees")
        .insert({
          match_id: matchId,
          user_id: userId,
          member_id: memberId ?? null,
          status,
        })
        .select()
        .single();

      if (error) throw error;

      const newAttendee: IMatchAttendee = {
        id: data.id,
        matchId: data.match_id,
        userId: data.user_id,
        memberId: data.member_id,
        status: data.status,
        registeredAt: data.registered_at,
      };

      set((state) => ({
        attendees: {
          ...state.attendees,
          [matchId]: [...(state.attendees[matchId] || []), newAttendee],
        },
      }));
    }
  },

  loadComments: async (matchId) => {
    const { data, error } = await supabase
      .from("match_comments")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (error || !data) return;

    // username 컬럼이 없는 기존 댓글을 위해 profiles로 fallback
    const needsFallback = data.filter((c) => !c.username).map((c) => c.user_id);
    const userIds = [...new Set(needsFallback)];
    let profileMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);
      profileMap = Object.fromEntries(
        (profiles || []).map((p) => [p.id, p.username ?? ""])
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapRow = (c: any): IMatchComment => ({
      id: c.id,
      matchId: c.match_id,
      userId: c.user_id,
      username: c.username || profileMap[c.user_id] || "알 수 없음",
      content: c.content,
      createdAt: c.created_at,
      updatedAt: c.updated_at ?? undefined,
      parentId: c.parent_id ?? undefined,
      replies: [],
    });

    // 루트 → 대댓글 트리 조립
    const roots = data.filter((c) => !c.parent_id).map(mapRow);
    const replyRows = data.filter((c) => c.parent_id);
    const comments: IMatchComment[] = roots.map((root) => ({
      ...root,
      replies: replyRows.filter((r) => r.parent_id === root.id).map(mapRow),
    }));

    set((state) => ({
      comments: { ...state.comments, [matchId]: comments },
    }));
  },

  addComment: async (matchId, userId, username, content, parentId) => {
    const { data, error } = await supabase
      .from("match_comments")
      .insert({
        match_id: matchId,
        user_id: userId,
        username,
        content,
        parent_id: parentId ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    const newComment: IMatchComment = {
      id: data.id,
      matchId: data.match_id,
      userId: data.user_id,
      username,
      content: data.content,
      createdAt: data.created_at,
      parentId: data.parent_id ?? undefined,
      replies: [],
    };

    set((state) => {
      const list = state.comments[matchId] || [];
      if (parentId) {
        // 대댓글: 부모의 replies에 추가
        return {
          comments: {
            ...state.comments,
            [matchId]: list.map((c) =>
              c.id === parentId
                ? { ...c, replies: [...(c.replies || []), newComment] }
                : c
            ),
          },
        };
      }
      return {
        comments: { ...state.comments, [matchId]: [...list, newComment] },
      };
    });
  },

  updateComment: async (commentId, matchId, content) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("match_comments")
      .update({ content, updated_at: now })
      .eq("id", commentId);

    if (error) throw error;

    set((state) => ({
      comments: {
        ...state.comments,
        [matchId]: (state.comments[matchId] || []).map((c) => {
          if (c.id === commentId) return { ...c, content, updatedAt: now };
          return {
            ...c,
            replies: (c.replies || []).map((r) =>
              r.id === commentId ? { ...r, content, updatedAt: now } : r
            ),
          };
        }),
      },
    }));
  },

  deleteComment: async (commentId, matchId) => {
    const { error } = await supabase
      .from("match_comments")
      .delete()
      .eq("id", commentId);

    if (error) throw error;

    set((state) => ({
      comments: {
        ...state.comments,
        [matchId]: (state.comments[matchId] || [])
          .filter((c) => c.id !== commentId)
          .map((c) => ({
            ...c,
            replies: (c.replies || []).filter((r) => r.id !== commentId),
          })),
      },
    }));
  },
}));
