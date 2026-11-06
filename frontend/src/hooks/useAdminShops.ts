import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { shopApi } from "@/api/shop.api";
import type { Shop } from "@/types";

export const adminShopKeys = {
  all: ["admin", "shops"] as const,
};

export function useAdminShops(
  params: { status?: Shop["status"]; page?: number; limit?: number } = {},
) {
  return useQuery({
    queryKey: [...adminShopKeys.all, params],
    queryFn: () => shopApi.listAllAdmin({ limit: 25, ...params }),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateShopStatusAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Shop["status"] }) =>
      shopApi.updateStatusAdmin(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminShopKeys.all }),
  });
}
