import { create } from "zustand";
import type { IDivision, ITeammateHistory } from "@/types";

interface IDivisionStore {
  divisionHistory: IDivision[];
  teammateHistory: ITeammateHistory;
  currentDivision: IDivision | null;
  setDivisionHistory: (history: IDivision[]) => void;
  setCurrentDivision: (division: IDivision | null) => void;
  saveDivision: (division: IDivision) => void;
  deleteDivision: (id: string) => void;
  clearAllDivisions: () => void;
  updateTeammateHistory: (history: ITeammateHistory) => void;
}

export const useDivisionStore = create<IDivisionStore>()((set) => ({
  divisionHistory: [],
  teammateHistory: {},
  currentDivision: null,

  setDivisionHistory: (history) => set({ divisionHistory: history }),

  setCurrentDivision: (division) => set({ currentDivision: division }),

  saveDivision: (division) =>
    set((state) => ({
      divisionHistory: [...state.divisionHistory, division],
    })),

  deleteDivision: (id) =>
    set((state) => ({
      divisionHistory: state.divisionHistory.filter((d) => d.id !== id),
    })),

  clearAllDivisions: () => set({ divisionHistory: [], teammateHistory: {} }),

  updateTeammateHistory: (history) => set({ teammateHistory: history }),
}));
