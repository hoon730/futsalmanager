import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { IMatch, IMatchAttendee } from "@/types";

interface IMatchStore {
  matches: IMatch[];
  attendees: Record<string, IMatchAttendee[]>;
  isLoading: boolean;
  loadMatches: (squadId: string) => Promise<void>;
  createMatch: (squadId: string, data: Omit<IMatch, "id" | "createdAt" | "squadId">) => Promise<void>;
  deleteMatch: (matchId: string) => Promise<void>;
  loadAttendees: (matchId: string) => Promise<void>;
  toggleAttendance: (matchId: string, userId: string, memberId?: string) => Promise<void>;
  setMatches: (matches: IMatch[]) => void;
}

export const useMatchStore = create<IMatchStore>()((set, get) => ({
  matches: [],
  attendees: {},
  isLoading: false,

  setMatches: (matches) => set({ matches }),

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
    };

    set((state) => ({
      matches: [...state.matches, newMatch].sort(
        (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()
      ),
    }));
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

    if (error) return;

    const attendees: IMatchAttendee[] = (data || []).map((a) => ({
      id: a.id,
      matchId: a.match_id,
      userId: a.user_id,
      memberId: a.member_id,
      status: a.status,
      registeredAt: a.registered_at,
    }));

    set((state) => ({
      attendees: { ...state.attendees, [matchId]: attendees },
    }));
  },

  toggleAttendance: async (matchId, userId, memberId) => {
    const current = get().attendees[matchId] || [];
    const existing = current.find((a) => a.userId === userId);

    if (existing) {
      // 이미 있으면 삭제 (참가 취소)
      const { error } = await supabase
        .from("match_attendees")
        .delete()
        .eq("match_id", matchId)
        .eq("user_id", userId);
      if (error) throw error;

      set((state) => ({
        attendees: {
          ...state.attendees,
          [matchId]: current.filter((a) => a.userId !== userId),
        },
      }));
    } else {
      // 없으면 추가 (참가 신청)
      const { data, error } = await supabase
        .from("match_attendees")
        .insert({ match_id: matchId, user_id: userId, member_id: memberId || null, status: "attending" })
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
}));
