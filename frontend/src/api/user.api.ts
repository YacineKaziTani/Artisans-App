import { api } from "@/lib/axios";
import type { User } from "@/types";

export interface UpdateMePayload {
  name?: string;
  phone?: string;
  avatarUrl?: string;
}

export const userApi = {
  getMine: () => api.get<User>("/users/mine").then((r) => r.data),
  updateMine: (payload: UpdateMePayload) =>
    api.patch<User>("/users/mine", payload).then((r) => r.data),

  listAllAdmin: () => api.get<User[]>("/users").then((r) => r.data),

  updateByAdmin: (
    id: string,
    payload: Partial<{ role: User["role"]; isActive: boolean }>,
  ) => api.patch<User>(`/users/${id}`, payload).then((r) => r.data),

  removeByAdmin: (id: string) => api.delete(`/users/${id}`).then((r) => r.data),
};
