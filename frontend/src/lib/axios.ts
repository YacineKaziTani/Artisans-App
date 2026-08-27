import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
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
