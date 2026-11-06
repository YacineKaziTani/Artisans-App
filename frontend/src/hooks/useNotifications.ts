import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "@/api/notification.api";

export const notificationKeys = {
  all: ["notifications"] as const,
};

/** The latest notifications and the unread count (refreshed live over the socket). */
export function useNotifications(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => notificationApi.list(1),
    enabled: options.enabled ?? true,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationApi.markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
