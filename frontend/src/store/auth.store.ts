import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  // hadi persist  tsavi l info ta3 user f storage ta3 lbrowser, pck ki dir refresh auth wel user yroho 7ata truni l function ta3 l auth again bach yrelogiweh, yasra flicker, hadi mem ysakar paga wyaftah mayasralosh problem
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      setAuth: (user) => {
        set({ user, isAuthenticated: true });
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: "auth-storage",
      // Only persist data fields, avoid trying to serialize functions
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
