import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IFixedTeam } from "@/types";

interface IFixedTeamStore {
  fixedTeams: IFixedTeam[];
  addFixedTeam: (team: IFixedTeam) => void;
  removeFixedTeam: (id: string) => void;
  clearAllFixedTeams: () => void;
}

export const useFixedTeamStore = create<IFixedTeamStore>()(
  persist(
    (set) => ({
      fixedTeams: [],

      addFixedTeam: (team) =>
        set((state) => ({
          fixedTeams: [...state.fixedTeams, team],
        })),

      removeFixedTeam: (id) =>
        set((state) => ({
          fixedTeams: state.fixedTeams.filter((t) => t.id !== id),
        })),

      clearAllFixedTeams: () => set({ fixedTeams: [] }),
    }),
    {
      name: "fixed-teams-storage",
    }
  )
);
