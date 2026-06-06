import { api } from "@/lib/axios";
import type { LoginPayload, RegisterPayload, User } from "@/types";

export const authApi = {
  login: (payload: LoginPayload) =>
    api
      .post<{ message: string; user: User }>("/auth/login", payload)
      .then((r) => r.data),

  register: (payload: RegisterPayload) =>
    api
      .post<{ message: string; user: User }>("/auth/register", payload)
      .then((r) => r.data),

  me: () => api.get<User>("/auth/me").then((r) => r.data),

  logout: () => api.post("/auth/logout").then((r) => r.data),
};
