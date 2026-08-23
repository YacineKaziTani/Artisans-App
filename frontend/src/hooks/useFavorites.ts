import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { favoriteApi } from "@/api/favorite.api";
import type { FavoriteTargetType } from "@/types";

export const favoriteKeys = {
  ids: (targetType: FavoriteTargetType) => ["favorites", "ids", targetType] as const,
  mine: ["favorites", "mine"] as const,
};

export function useFavoriteIds(
  targetType: FavoriteTargetType,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: favoriteKeys.ids(targetType),
    queryFn: () => favoriteApi.myIds(targetType),
    enabled: options.enabled ?? true,
  });
}

export function useToggleFavorite(targetType: FavoriteTargetType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string) => favoriteApi.toggle(targetType, targetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: favoriteKeys.ids(targetType) });
      qc.invalidateQueries({ queryKey: favoriteKeys.mine });
    },
  });
}

export function useMyFavorites() {
  return useQuery({
    queryKey: favoriteKeys.mine,
    queryFn: favoriteApi.mine,
  });
}
