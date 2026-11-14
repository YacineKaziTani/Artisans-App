import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
const media = () => window.matchMedia?.("(prefers-color-scheme: dark)");

function readStoredMode(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function apply(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && Boolean(media()?.matches));
  document.documentElement.classList.toggle("dark", dark);
}

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

/**
 * Light / dark / follow the device. public/theme-init.js applies the saved
 * choice before first paint; this keeps it in sync afterwards.
 */
export const useThemeStore = create<ThemeState>((set) => ({
  mode: readStoredMode(),
  setMode: (mode) => {
    try {
      if (mode === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Private mode / blocked storage: still switch for this visit.
    }
    apply(mode);
    set({ mode });
  },
}));

// Follow the device setting live while the choice is "system".
media()?.addEventListener?.("change", () => {
  if (useThemeStore.getState().mode === "system") apply("system");
});
