import { create } from "zustand";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false, // will be hydrated by useMe() on app load

  setAuth: (user) => {
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    set({ user: null, isAuthenticated: false });
  },
}));
