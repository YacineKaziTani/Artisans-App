import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { userApi, type AdminUserListParams } from "@/api/user.api";
import type { User } from "@/types";

export const adminUserKeys = {
  all: ["admin", "users"] as const,
};

export function useAdminUsers(params: AdminUserListParams = {}) {
  return useQuery({
    queryKey: [...adminUserKeys.all, params],
    queryFn: () => userApi.listAllAdmin(params),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateUserByAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<{ role: User["role"]; isActive: boolean }>;
    }) => userApi.updateByAdmin(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminUserKeys.all }),
  });
}

export function useDeleteUserByAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => userApi.removeByAdmin(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminUserKeys.all }),
  });
}
