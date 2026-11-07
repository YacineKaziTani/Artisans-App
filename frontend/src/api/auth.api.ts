import { api } from "@/lib/axios";
import type { LoginPayload, RegisterPayload, User } from "@/types";

export const authApi = {
  /** Either signs in ({ user }) or asks for the authenticator code ({ twoFactorRequired, challenge }). */
  login: (payload: LoginPayload) =>
    api
      .post<{ message?: string; user?: User; twoFactorRequired?: boolean; challenge?: string }>("/auth/login", payload)
      .then((r) => r.data),

  loginSecondStep: (payload: { challenge: string; code: string }) =>
    api.post<{ message: string; user: User }>("/auth/login/2fa", payload).then((r) => r.data),

  logoutAll: () => api.post<{ message: string }>("/auth/logout-all").then((r) => r.data),

  twoFactorSetup: () =>
    api.post<{ secret: string; otpauthUrl: string }>("/auth/2fa/setup").then((r) => r.data),

  twoFactorEnable: (code: string) =>
    api.post<{ message: string; recoveryCodes: string[] }>("/auth/2fa/enable", { code }).then((r) => r.data),

  twoFactorDisable: (payload: { password: string; code: string }) =>
    api.post<{ message: string }>("/auth/2fa/disable", payload).then((r) => r.data),

  register: (payload: RegisterPayload) =>
    api
      .post<{ message: string; user: User }>("/auth/register", payload)
      .then((r) => r.data),

  me: () => api.get<User>("/auth/me").then((r) => r.data),

  logout: () => api.post("/auth/logout").then((r) => r.data),

  forgotPassword: (email: string) =>
    api
      .post<{ message: string }>("/auth/forgot-password", { email })
      .then((r) => r.data),

  resetPassword: (payload: { email: string; token: string; newPassword: string }) =>
    api
      .post<{ message: string }>("/auth/reset-password", payload)
      .then((r) => r.data),

  /** The link from the confirmation email. */
  verifyEmail: (token: string) =>
    api
      .post<{ message: string }>("/auth/verify-email", { token })
      .then((r) => r.data),

  resendVerification: () =>
    api
      .post<{ message: string; alreadyVerified?: boolean }>("/auth/resend-verification")
      .then((r) => r.data),
};
