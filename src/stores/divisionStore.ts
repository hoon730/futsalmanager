import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IDivision, ITeammateHistory } from "@/types";

interface IDivisionStore {
  divisionHistory: IDivision[];
  teammateHistory: ITeammateHistory;
  currentDivision: IDivision | null;
  setCurrentDivision: (division: IDivision | null) => void;
  saveDivision: (division: IDivision) => void;
  deleteDivision: (id: string) => void;
  clearAllDivisions: () => void;
  updateTeammateHistory: (history: ITeammateHistory) => void;
}

export const useDivisionStore = create<IDivisionStore>()(
  persist(
    (set) => ({
      divisionHistory: [],
      teammateHistory: {},
      currentDivision: null,

      setCurrentDivision: (division) => set({ currentDivision: division }),

      saveDivision: (division) =>
        set((state) => ({
          divisionHistory: [...state.divisionHistory, division],
        })),

      deleteDivision: (id) =>
        set((state) => ({
          divisionHistory: state.divisionHistory.filter((d) => d.id !== id),
        })),

      clearAllDivisions: () =>
        set({ divisionHistory: [], teammateHistory: {} }),

      updateTeammateHistory: (history) =>
        set({ teammateHistory: history }),
    }),
    {
      name: "division-storage",
    }
  )
);
