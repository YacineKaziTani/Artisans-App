import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shopApi, type ListShopsParams } from "@/api/shop.api";

export const shopKeys = {
  all: ["shops"] as const,
  list: (params: ListShopsParams) => [...shopKeys.all, "list", params] as const,
  detail: (id: string) => [...shopKeys.all, "detail", id] as const,
  mine: () => [...shopKeys.all, "mine"] as const,
};

export function useShops(params: ListShopsParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: shopKeys.list(params),
    queryFn: () => shopApi.list(params),
    enabled: options.enabled ?? true,
  });
}

export function useShop(id: string | undefined) {
  return useQuery({
    queryKey: shopKeys.detail(id ?? ""),
    queryFn: () => shopApi.getById(id!),
    enabled: Boolean(id),
  });
}

export function useMyShop(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: shopKeys.mine(),
    queryFn: shopApi.getMine,
    enabled: options.enabled ?? true,
    retry: false,
  });
}

export function useUpdateMyShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shopApi.updateMine,
    onSuccess: (shop) => {
      qc.setQueryData(shopKeys.mine(), shop);
    },
  });
}

export function useCreateShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shopApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopKeys.mine() });
    },
  });
}

export function useCloseMyShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shopApi.closeMine,
    onSuccess: (shop) => qc.setQueryData(shopKeys.mine(), shop),
  });
}

export function useReopenMyShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shopApi.reopenMine,
    onSuccess: (shop) => qc.setQueryData(shopKeys.mine(), shop),
  });
}
