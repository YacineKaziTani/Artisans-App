import axios from "axios";

export const api = axios.create({
  // Vercel has no dev proxy, so production needs the absolute Render URL.
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  withCredentials: true,
});

const AUTH_ENDPOINTS = ["/auth/login", "/auth/register", "/auth/me"];

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url ?? "";
    const isAuthCall = AUTH_ENDPOINTS.some((path) => url.startsWith(path));

    if (
      error.response?.status === 401 &&
      !isAuthCall &&
      window.location.pathname !== "/login"
    ) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);
