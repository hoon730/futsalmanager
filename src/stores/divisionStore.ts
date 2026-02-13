import { create } from "zustand";
import type { IDivision, ITeammateHistory } from "@/types";
import { deleteDivisionFromSupabase } from "@/lib/supabaseSync";
import { supabase } from "@/lib/supabase";

interface IDivisionStore {
  divisionHistory: IDivision[];
  teammateHistory: ITeammateHistory;
  currentDivision: IDivision | null;
  setDivisionHistory: (history: IDivision[]) => void;
  setCurrentDivision: (division: IDivision | null) => void;
  saveDivision: (division: IDivision) => void;
  deleteDivision: (id: string) => Promise<void>;
  clearAllDivisions: () => Promise<void>;
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

  deleteDivision: async (id) => {
    // Supabase에서 삭제
    await deleteDivisionFromSupabase(id);

    // 로컬 스토어에서 삭제
    set((state) => ({
      divisionHistory: state.divisionHistory.filter((d) => d.id !== id),
    }));
  },

  clearAllDivisions: async () => {
    // 현재 스토어의 스쿼드 ID를 가져와야 함
    const { data: divisions } = await supabase
      .from("divisions")
      .select("id");

    if (divisions) {
      // Supabase에서 모든 이력 삭제
      for (const division of divisions) {
        await deleteDivisionFromSupabase(division.id);
      }
    }

    // 로컬 스토어 초기화
    set({ divisionHistory: [], teammateHistory: {} });
  },

  updateTeammateHistory: (history) => set({ teammateHistory: history }),
}));
