import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastStore {
  items: ToastItem[];
  add: (message: string, type: ToastType) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  items: [],
  add: (message, type) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    set((s) => ({ items: [...s.items, { id, message, type }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 4000);
  },
  remove: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (msg: string) => useToastStore.getState().add(msg, 'success'),
  error: (msg: string) => useToastStore.getState().add(msg, 'error'),
  info: (msg: string) => useToastStore.getState().add(msg, 'info'),
  warning: (msg: string) => useToastStore.getState().add(msg, 'warning'),
};
