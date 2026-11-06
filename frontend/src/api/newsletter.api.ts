import { api } from "@/lib/axios";

export const newsletterApi = {
  subscribe: (email: string) =>
    api.post<{ message: string }>("/newsletter/subscribe", { email }).then((r) => r.data),
  confirm: (token: string) =>
    api.post<{ message: string }>("/newsletter/confirm", { token }).then((r) => r.data),
  unsubscribe: (token: string) =>
    api.post<{ message: string }>("/newsletter/unsubscribe", { token }).then((r) => r.data),
  stats: () =>
    api.get<{ subscribed: number; pending: number }>("/newsletter/admin/stats").then((r) => r.data),
  /** The subscribers CSV, as a Blob (the request needs the admin's cookie). */
  exportCsv: () =>
    api.get<Blob>("/newsletter/admin/export", { responseType: "blob" }).then((r) => r.data),
};
