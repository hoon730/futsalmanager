// 동호회 단위 용병 풀 (squad_mercenaries 테이블)
// - 기존 DivisionPage 의 localStorage('mercenaries') 를 대체
// - 동호회 멤버 전체가 같은 용병 명단을 공유
// - 매치별 참석 기록은 기존 match_mercenaries 테이블이 담당
import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { IMember } from "@/types";

interface ISquadMercenaryStore {
  mercenaries: IMember[];
  isLoading: boolean;

  /** squad 의 용병 풀 로드 (squad 전환 시 호출) */
  load: (squadId: string) => Promise<void>;
  /** 새 용병 추가. UNIQUE(squad_id, name) 위반은 친절한 메시지로 throw */
  add: (squadId: string, name: string) => Promise<IMember>;
  /** 용병 삭제. squad_mercenaries 만 삭제 (match_mercenaries 와 별개) */
  remove: (id: string) => Promise<void>;
  /** squad 전환 시 이전 상태 초기화 */
  clear: () => void;
  /**
   * match_mercenaries 에서 추가된 용병 이름들을 squad pool 에 누적 (upsert).
   * 중복은 UNIQUE 제약으로 무시되고, 새로 들어간 행은 다음 load 때 반영된다.
   */
  ingestNames: (squadId: string, names: string[]) => Promise<void>;
}

const toMember = (row: { id: string; name: string; created_at: string | null }): IMember => ({
  id: row.id,
  name: row.name,
  isMercenary: true,
  active: true,
  createdAt: row.created_at ?? new Date().toISOString(),
});

export const useSquadMercenaryStore = create<ISquadMercenaryStore>()((set, get) => ({
  mercenaries: [],
  isLoading: false,

  load: async (squadId) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from("squad_mercenaries")
        .select("id, name, created_at")
        .eq("squad_id", squadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      set({ mercenaries: (data || []).map(toMember) });
    } catch (e) {
      console.error("squad_mercenaries 로드 실패:", e);
    } finally {
      set({ isLoading: false });
    }
  },

  add: async (squadId, name) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("이름을 입력해주세요");
    if (get().mercenaries.some((m) => m.name === trimmed)) {
      throw new Error("이미 추가된 용병입니다");
    }

    const { data, error } = await supabase
      .from("squad_mercenaries")
      .insert({ squad_id: squadId, name: trimmed })
      .select("id, name, created_at")
      .single();

    if (error) {
      // 23505 = unique_violation (다른 운영자가 먼저 추가한 경우)
      if (error.code === "23505") throw new Error("이미 추가된 용병입니다");
      throw error;
    }

    const merc = toMember(data);
    set((state) => ({ mercenaries: [merc, ...state.mercenaries] }));
    return merc;
  },

  remove: async (id) => {
    const { error } = await supabase
      .from("squad_mercenaries")
      .delete()
      .eq("id", id);
    if (error) throw error;
    set((state) => ({ mercenaries: state.mercenaries.filter((m) => m.id !== id) }));
  },

  clear: () => set({ mercenaries: [] }),

  ingestNames: async (squadId, names) => {
    const existing = new Set(get().mercenaries.map((m) => m.name));
    const newNames = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)))
      .filter((n) => !existing.has(n));
    if (newNames.length === 0) return;

    const rows = newNames.map((name) => ({ squad_id: squadId, name }));
    const { error } = await supabase
      .from("squad_mercenaries")
      .upsert(rows, { onConflict: "squad_id,name", ignoreDuplicates: true });
    if (error) {
      console.error("squad_mercenaries ingest 실패:", error);
      return;
    }
    // 정확한 id/created_at 을 얻기 위해 다시 로드 (소수의 행이므로 비용 미미)
    await get().load(squadId);
  },
}));
