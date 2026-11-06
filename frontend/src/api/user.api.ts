import { api } from "@/lib/axios";
import type { Page, PageParams, User } from "@/types";

export interface UpdateMePayload {
  name?: string;
  phone?: string;
  avatarUrl?: string | null;
}

export interface AdminUserListParams extends PageParams {
  search?: string;
  role?: User["role"];
}

export const userApi = {
  getMine: () => api.get<User>("/users/mine").then((r) => r.data),
  updateMine: (payload: UpdateMePayload) =>
    api.patch<User>("/users/mine", payload).then((r) => r.data),

  listAllAdmin: (params: AdminUserListParams = {}) =>
    api.get<Page<User>>("/users", { params }).then((r) => r.data),

  updateByAdmin: (
    id: string,
    payload: Partial<{ role: User["role"]; isActive: boolean }>,
  ) => api.patch<User>(`/users/${id}`, payload).then((r) => r.data),

  removeByAdmin: (id: string) => api.delete(`/users/${id}`).then((r) => r.data),

  /** Signs every session out (including this one) — the user logs in again. */
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    api
      .patch<{ message: string }>("/users/mine/password", payload)
      .then((r) => r.data),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("image", file);
    return api.post<User>("/users/mine/avatar", form).then((r) => r.data);
  },
};
