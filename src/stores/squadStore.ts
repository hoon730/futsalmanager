import { create } from "zustand";
import type { ISquad, IMember } from "@/types";

interface ISquadStore {
  squad: ISquad | null;
  selectedParticipants: string[];
  isLoading: boolean;
  error: string | null;
  setSquad: (squad: ISquad) => void;
  updateSquadName: (name: string) => void;
  addMember: (member: IMember) => void;
  removeMember: (id: string) => void;
  toggleParticipant: (id: string) => void;
  selectAllParticipants: () => void;
  clearAllParticipants: () => void;
  clearAllData: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSquadStore = create<ISquadStore>()((set) => ({
  squad: null,
  selectedParticipants: [],
  isLoading: false,
  error: null,

  setSquad: (squad) => set({ squad, error: null }),

  updateSquadName: (name) =>
    set((state) => ({
      squad: state.squad ? { ...state.squad, name } : null,
    })),

  addMember: (member) =>
    set((state) => ({
      squad: state.squad
        ? {
            ...state.squad,
            members: [...state.squad.members, member],
          }
        : null,
    })),

  removeMember: (id) =>
    set((state) => ({
      squad: state.squad
        ? {
            ...state.squad,
            members: state.squad.members.filter((m) => m.id !== id),
          }
        : null,
      selectedParticipants: state.selectedParticipants.filter(
        (pid) => pid !== id
      ),
    })),

  toggleParticipant: (id) =>
    set((state) => ({
      selectedParticipants: state.selectedParticipants.includes(id)
        ? state.selectedParticipants.filter((pid) => pid !== id)
        : [...state.selectedParticipants, id],
    })),

  selectAllParticipants: () =>
    set((state) => ({
      selectedParticipants: state.squad?.members.map((m) => m.id) || [],
    })),

  clearAllParticipants: () => set({ selectedParticipants: [] }),

  clearAllData: () =>
    set({
      squad: null,
      selectedParticipants: [],
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),
}));
