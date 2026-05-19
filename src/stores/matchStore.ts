import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { toast } from "@/stores/toastStore";
import { toFriendlyMessage } from "@/lib/errorMessage";
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
    if (!trimmed) throw new Error("이름을 입력해주세요");
    const current = get().matchMercenaries[matchId] || [];
    if (current.some((m) => m.name === trimmed)) {
      throw new Error("이미 등록된 이름입니다");
    }

    const { data, error } = await supabase
      .from("match_mercenaries")
      .insert({ match_id: matchId, name: trimmed })
      .select()
      .single();

    if (error) {
      // 23505 = unique_violation (다른 세션에서 동시에 같은 이름 추가)
      if (error.code === "23505") throw new Error("이미 등록된 이름입니다");
      throw error;
    }

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

      // 한 번에 모든 attendees 조회 (이전엔 match 개수만큼 N+1 발생)
      const matchIds = matches.map((m) => m.id);
      if (matchIds.length > 0) {
        const { data: attRows } = await supabase
          .from("match_attendees")
          .select("*")
          .in("match_id", matchIds);

        const userIds = [...new Set((attRows || []).map((a) => a.user_id))];
        let profileMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username")
            .in("id", userIds);
          profileMap = Object.fromEntries(
            (profiles || []).map((p) => [p.id, p.username ?? ""]),
          );
        }

        const grouped: Record<string, IMatchAttendee[]> = {};
        for (const id of matchIds) grouped[id] = [];
        for (const a of attRows || []) {
          grouped[a.match_id].push({
            id: a.id,
            matchId: a.match_id,
            userId: a.user_id,
            memberId: a.member_id,
            status: a.status,
            registeredAt: a.registered_at,
            username: profileMap[a.user_id] || undefined,
          });
        }

        set((state) => ({ attendees: { ...state.attendees, ...grouped } }));
      }
    } catch (e) {
      console.error("경기 로드 실패:", e);
      toast(toFriendlyMessage(e, "경기 일정을 불러오지 못했습니다"), "error");
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
    // 결과를 토스트로 안내해 운영자가 전송 성공/실패를 즉시 확인할 수 있도록 함
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
      .then(({ data, error }) => {
        if (error) {
          console.error("[push] 알림 전송 실패:", error);
          toast(toFriendlyMessage(error, "경기는 등록됐지만 알림 전송에 실패했습니다"), "error");
          return;
        }
        const sent = (data as { sent?: number } | null)?.sent ?? 0;
        const failed = (data as { failed?: number } | null)?.failed ?? 0;
        if (sent === 0 && failed === 0) {
          toast("알림 구독자가 없습니다 (멤버들이 설정에서 알림을 켜야 합니다)", "info");
        } else if (failed > 0) {
          toast(`${sent}명에게 알림 전송 (${failed}명 실패)`, "info");
        } else {
          toast(`${sent}명에게 경기 알림을 보냈습니다`);
        }
      })
      .catch((e) => {
        console.error("[push] invoke 예외:", e);
        toast(toFriendlyMessage(e, "알림 전송 중 오류가 발생했습니다"), "error");
      });
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

    if (existing && existing.status === status && memberId === undefined) return;

    // 낙관적 업데이트: 동일 사용자 클릭이 빠르게 연속되더라도 unique 제약 + upsert로 안전
    set((state) => ({
      attendees: {
        ...state.attendees,
        [matchId]: existing
          ? current.map((a) =>
              a.userId === userId
                ? { ...a, status, ...(memberId !== undefined ? { memberId } : {}) }
                : a,
            )
          : [
              ...current,
              {
                id: `temp-${userId}`,
                matchId,
                userId,
                memberId,
                status,
                registeredAt: new Date().toISOString(),
              },
            ],
      },
    }));

    const { data, error } = await supabase
      .from("match_attendees")
      .upsert(
        {
          match_id: matchId,
          user_id: userId,
          member_id: memberId ?? null,
          status,
        },
        { onConflict: "match_id,user_id" },
      )
      .select()
      .single();

    if (error) {
      // 롤백
      set((state) => ({
        attendees: { ...state.attendees, [matchId]: current },
      }));
      throw error;
    }

    // 서버 응답으로 실제 id/registered_at 동기화 (temp-* 행 교체)
    set((state) => ({
      attendees: {
        ...state.attendees,
        [matchId]: (state.attendees[matchId] || []).map((a) =>
          a.userId === userId
            ? {
                id: data.id,
                matchId: data.match_id,
                userId: data.user_id,
                memberId: data.member_id,
                status: data.status,
                registeredAt: data.registered_at,
                username: a.username,
              }
            : a,
        ),
      },
    }));
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

    // 루트 → 대댓글 트리 조립 (현재는 1단계 대댓글만 지원)
    const roots = data.filter((c) => !c.parent_id).map(mapRow);
    const rootIds = new Set(roots.map((r) => r.id));
    const replyRows = data.filter((c) => c.parent_id);

    // 부모가 루트가 아닌 경우(중첩 또는 삭제된 부모) — UI에 안 나타나는 데이터가 생기지 않도록 경고
    const orphans = replyRows.filter((r) => r.parent_id && !rootIds.has(r.parent_id));
    if (orphans.length > 0) {
      console.warn(
        `[matchStore] 댓글 ${orphans.length}개가 부모를 찾지 못해 표시되지 않습니다 (match ${matchId})`,
        orphans.map((o) => ({ id: o.id, parent_id: o.parent_id })),
      );
    }

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
