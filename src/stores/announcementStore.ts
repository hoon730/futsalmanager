import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface IAnnouncement {
  id: string;
  squadId: string;
  content: string;
  createdBy?: string;
  pinned: boolean;
  createdAt: string;
}

interface IAnnouncementStore {
  announcements: IAnnouncement[];
  isLoading: boolean;
  loadAnnouncements: (squadId: string) => Promise<void>;
  addAnnouncement: (squadId: string, content: string, createdBy: string) => Promise<void>;
  updateAnnouncement: (id: string, content: string) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  togglePin: (id: string, pinned: boolean) => Promise<void>;
}

export const useAnnouncementStore = create<IAnnouncementStore>()((set) => ({
  announcements: [],
  isLoading: false,

  loadAnnouncements: async (squadId) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("squad_id", squadId)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      const announcements: IAnnouncement[] = (data || []).map((a) => ({
        id: a.id,
        squadId: a.squad_id,
        content: a.content,
        createdBy: a.created_by ?? undefined,
        pinned: a.pinned,
        createdAt: a.created_at,
      }));

      set({ announcements });
    } finally {
      set({ isLoading: false });
    }
  },

  addAnnouncement: async (squadId, content, createdBy) => {
    const { data, error } = await supabase
      .from("announcements")
      .insert({ squad_id: squadId, content, created_by: createdBy, pinned: false })
      .select()
      .single();

    if (error) throw error;

    const newItem: IAnnouncement = {
      id: data.id,
      squadId: data.squad_id,
      content: data.content,
      createdBy: data.created_by ?? undefined,
      pinned: data.pinned,
      createdAt: data.created_at,
    };

    set((state) => ({
      announcements: [newItem, ...state.announcements],
    }));
  },

  updateAnnouncement: async (id, content) => {
    const { error } = await supabase
      .from("announcements")
      .update({ content })
      .eq("id", id);
    if (error) throw error;
    set((state) => ({
      announcements: state.announcements.map((a) =>
        a.id === id ? { ...a, content } : a
      ),
    }));
  },

  deleteAnnouncement: async (id) => {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) throw error;
    set((state) => ({
      announcements: state.announcements.filter((a) => a.id !== id),
    }));
  },

  togglePin: async (id, pinned) => {
    const { error } = await supabase
      .from("announcements")
      .update({ pinned })
      .eq("id", id);
    if (error) throw error;

    set((state) => {
      const updated = state.announcements.map((a) =>
        a.id === id ? { ...a, pinned } : a
      );
      // pinned 우선 → 최신순 재정렬
      updated.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      return { announcements: updated };
    });
  },
}));
