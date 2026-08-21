import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userApi } from "@/api/user.api";
import { useAuthStore } from "@/store/auth.store";

export const userKeys = {
  mine: ["users", "mine"] as const,
};

export function useMyProfile() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: userKeys.mine,
    queryFn: userApi.getMine,
    enabled: isAuthenticated,
  });
}

export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: userApi.updateMine,
    onSuccess: (user) => {
      qc.setQueryData(userKeys.mine, user);
    },
  });
}
