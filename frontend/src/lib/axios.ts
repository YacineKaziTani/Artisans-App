import axios from "axios";
import { useAuthStore } from "@/store/auth.store";

export const api = axios.create({
  // Vercel has no dev proxy, so production needs the absolute Render URL.
  // `||`, not `??`: .env.example ships `VITE_API_URL=` (an empty string),
  // which `??` kept, so every request went to "/auth/..." instead of "/api/...".
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
});

const AUTH_ENDPOINTS = ["/auth/login", "/auth/register", "/auth/me"];

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url ?? "";
    const isAuthCall = AUTH_ENDPOINTS.some((path) => url.startsWith(path));

    if (error.response?.status === 401 && !isAuthCall) {
      // Forget the persisted session *before* navigating. Otherwise the
      // reloaded app still thinks it's logged in, GuestGuard bounces /login
      // to /dashboard, the next call 401s again, and the page loops.
      useAuthStore.getState().logout();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
