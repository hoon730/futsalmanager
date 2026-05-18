import { create } from "zustand";

export interface IToast {
  id: number;
  message: string;
  type: "info" | "success" | "error";
}

interface IToastStore {
  toasts: IToast[];
  show: (message: string, type?: IToast["type"]) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToastStore = create<IToastStore>((set, get) => ({
  toasts: [],
  show: (message, type = "success") => {
    counter += 1;
    const id = counter;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().dismiss(id), 2000);
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** 어디서든 호출 가능한 헬퍼 */
export const toast = (message: string, type?: IToast["type"]) =>
  useToastStore.getState().show(message, type);
