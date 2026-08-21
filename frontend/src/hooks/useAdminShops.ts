import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shopApi } from "@/api/shop.api";
import type { Shop } from "@/types";

export const adminShopKeys = {
  all: ["admin", "shops"] as const,
};

export function useAdminShops() {
  return useQuery({
    queryKey: adminShopKeys.all,
    queryFn: () => shopApi.listAllAdmin({ limit: 100 }),
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
