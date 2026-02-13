import { create } from "zustand";
import { persist } from "zustand/middleware";

interface IAdminStore {
  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean) => void;
  logout: () => void;
}

export const useAdminStore = create<IAdminStore>()(
  persist(
    (set) => ({
      isAdmin: false,
      setIsAdmin: (isAdmin) => set({ isAdmin }),
      logout: () => set({ isAdmin: false }),
    }),
    {
      name: "admin-storage", // localStorage 키
    }
  )
);
