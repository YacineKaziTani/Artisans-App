import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { favoriteApi } from "@/api/favorite.api";
import type { FavoriteTargetType } from "@/types";
import { toast } from "@/lib/toast";

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
    onSuccess: ({ favorited }) => {
      if (targetType === "shop") {
        toast.success(favorited ? "You're following this shop" : "Unfollowed", {
          description: favorited ? "You'll hear about new pieces from them." : undefined,
        });
      } else {
        toast.success(favorited ? "Saved to your favorites" : "Removed from favorites", {
          action: favorited ? { label: "View favorites", href: "/favorites" } : undefined,
        });
      }
      qc.invalidateQueries({ queryKey: favoriteKeys.ids(targetType) });
      qc.invalidateQueries({ queryKey: favoriteKeys.mine });
    },
    onError: () => toast.error("Couldn't update your favorites — please try again."),
  });
}

export function useMyFavorites() {
  return useQuery({
    queryKey: favoriteKeys.mine,
    queryFn: favoriteApi.mine,
  });
}
