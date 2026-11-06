import { api } from "@/lib/axios";
import type { Page, PageParams, User } from "@/types";

export interface UpdateMePayload {
  name?: string;
  phone?: string;
  avatarUrl?: string | null;
  emailNotifications?: boolean;
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

  /** Your invite code and how many people joined with it. */
  referrals: () =>
    api.get<{ code: string; joined: number; artisans: number }>("/users/mine/referrals").then((r) => r.data),

  /** Admin: which email provider is set up, and whether it reaches real users. */
  emailStatus: () =>
    api.get<EmailStatus>("/users/admin/email-status").then((r) => r.data),

  /** Admin: sends a test email to yourself; rejects with the provider's error. */
  sendTestEmail: () =>
    api
      .post<EmailStatus & { sentTo: string; sent: boolean }>("/users/admin/test-email")
      .then((r) => r.data),
};

export interface EmailStatus {
  provider: "resend" | "smtp" | "none";
  from: string;
  problem: string | null;
}
