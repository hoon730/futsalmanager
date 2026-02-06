import { create } from "zustand";
import type { IFixedTeam } from "@/types";

interface IFixedTeamStore {
  fixedTeams: IFixedTeam[];
  setFixedTeams: (teams: IFixedTeam[]) => void;
  addFixedTeam: (team: IFixedTeam) => void;
  removeFixedTeam: (id: string) => void;
  clearAllFixedTeams: () => void;
}

export const useFixedTeamStore = create<IFixedTeamStore>()((set) => ({
  fixedTeams: [],

  setFixedTeams: (teams) => set({ fixedTeams: teams }),

  addFixedTeam: (team) =>
    set((state) => ({
      fixedTeams: [...state.fixedTeams, team],
    })),

  removeFixedTeam: (id) =>
    set((state) => ({
      fixedTeams: state.fixedTeams.filter((t) => t.id !== id),
    })),

  clearAllFixedTeams: () => set({ fixedTeams: [] }),
}));
