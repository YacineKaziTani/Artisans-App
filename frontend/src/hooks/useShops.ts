import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shopApi, type ListShopsParams } from "@/api/shop.api";
import { authKeys } from "@/hooks/useAuth";
import { track } from "@/lib/analytics";

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

// Shop mutations refetch "my shop" rather than writing the response into
// the cache: the response is the bare shop, and writing it over the cached
// one dropped its services/photos until the next reload.

export function useUpdateMyShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shopApi.updateMine,
    onSuccess: () => qc.invalidateQueries({ queryKey: shopKeys.mine() }),
  });
}

export function useCreateShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shopApi.create,
    onSuccess: () => {
      track("Shop created");
      qc.invalidateQueries({ queryKey: shopKeys.mine() });
      // Creating a shop promotes the account to artisan on the server; the
      // stored session still says "client" until /auth/me is refetched, which
      // kept the dashboard locked until the next login.
      qc.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}

export function useCloseMyShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shopApi.closeMine,
    onSuccess: () => qc.invalidateQueries({ queryKey: shopKeys.mine() }),
  });
}

export function useReopenMyShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shopApi.reopenMine,
    onSuccess: () => qc.invalidateQueries({ queryKey: shopKeys.mine() }),
  });
}

export function useRequestVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shopApi.requestVerification,
    onSuccess: () => qc.invalidateQueries({ queryKey: shopKeys.mine() }),
  });
}

export function useResolveVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      note,
    }: {
      id: string;
      status: "verified" | "rejected";
      note?: string;
    }) => shopApi.resolveVerification(id, status, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "shops"] });
    },
  });
}

export function useConnectStripe() {
  return useMutation({
    mutationFn: shopApi.connectStripe,
  });
}

export function useStripeStatus(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...shopKeys.mine(), "stripe-status"],
    queryFn: shopApi.getStripeStatus,
    enabled: options.enabled ?? true,
  });
}

/** Artisan dashboard numbers (needs a shop — 404s without one). */
export function useMyShopStats(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...shopKeys.mine(), "stats"],
    queryFn: shopApi.getMyStats,
    enabled: options.enabled ?? true,
    retry: false,
  });
}

/** Admin preview of any shop, including pending ones. */
export function useUploadShopCover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shopApi.uploadCover,
    onSuccess: () => qc.invalidateQueries({ queryKey: shopKeys.all }),
  });
}

export function useRemoveShopCover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shopApi.removeCover,
    onSuccess: () => qc.invalidateQueries({ queryKey: shopKeys.all }),
  });
}

export function useUpdateShopHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shopApi.updateHours,
    onSuccess: () => qc.invalidateQueries({ queryKey: shopKeys.mine() }),
  });
}

export function useUpdateShopDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shopApi.updateDelivery,
    onSuccess: () => qc.invalidateQueries({ queryKey: shopKeys.mine() }),
  });
}

export function useMyEarnings(page: number) {
  return useQuery({
    queryKey: [...shopKeys.mine(), "earnings", page],
    queryFn: () => shopApi.getMyEarnings(page),
    placeholderData: keepPreviousData,
  });
}

/** Opens the artisan's Stripe dashboard in a new tab (links are single-use). */
export function useOpenStripeDashboard() {
  return useMutation({
    mutationFn: shopApi.getStripeDashboardLink,
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener"),
  });
}

export function useAdminShopPreview(id: string | null) {
  return useQuery({
    queryKey: ["admin", "shops", "preview", id ?? ""],
    queryFn: () => shopApi.getAdminPreview(id!),
    enabled: Boolean(id),
  });
}
