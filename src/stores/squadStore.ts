import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ISquad, IMember } from "@/types";

interface ISquadStore {
  squad: ISquad | null;
  selectedParticipants: string[];
  setSquad: (squad: ISquad) => void;
  updateSquadName: (name: string) => void;
  addMember: (member: IMember) => void;
  removeMember: (id: string) => void;
  toggleParticipant: (id: string) => void;
  selectAllParticipants: () => void;
  clearAllParticipants: () => void;
  clearAllData: () => void;
}

export const useSquadStore = create<ISquadStore>()(
  persist(
    (set) => ({
      squad: {
        id: Date.now().toString(),
        name: "내 스쿼드",
        members: [],
        createdAt: new Date().toISOString(),
      },
      selectedParticipants: [],

      setSquad: (squad) => set({ squad }),

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

      clearAllParticipants: () =>
        set({ selectedParticipants: [] }),

      clearAllData: () =>
        set({
          squad: {
            id: Date.now().toString(),
            name: "내 스쿼드",
            members: [],
            createdAt: new Date().toISOString(),
          },
          selectedParticipants: [],
        }),
    }),
    {
      name: "squad-storage",
    }
  )
);
