import { api } from "@/lib/axios";
import type { AppNotification } from "@/types";

export interface NotificationPage {
  data: AppNotification[];
  meta: { total: number; page: number; lastPage: number };
  unread: number;
}

export const notificationApi = {
  list: (page = 1) =>
    api.get<NotificationPage>("/notifications", { params: { page } }).then((r) => r.data),

  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () => api.post("/notifications/read-all").then((r) => r.data),
};
