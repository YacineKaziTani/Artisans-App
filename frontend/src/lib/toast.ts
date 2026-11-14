import { create } from "zustand";

export type ToastTone = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, "id">) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;
const MAX_VISIBLE = 4;
const DURATION_MS = { success: 3500, info: 4500, error: 6000 } as const;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { ...toast, id }].slice(-MAX_VISIBLE) });
    setTimeout(() => get().dismiss(id), DURATION_MS[toast.tone]);
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

type Extra = Pick<ToastItem, "description" | "action">;

/**
 * Short pop-up confirmations: `toast.success("Added to cart")`. Rendered by
 * <Toaster /> at the app root; callable from anywhere, including mutation
 * callbacks outside React.
 */
export const toast = {
  success: (title: string, extra?: Extra) => useToastStore.getState().push({ tone: "success", title, ...extra }),
  error: (title: string, extra?: Extra) => useToastStore.getState().push({ tone: "error", title, ...extra }),
  info: (title: string, extra?: Extra) => useToastStore.getState().push({ tone: "info", title, ...extra }),
};
