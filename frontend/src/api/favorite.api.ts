import { api } from "@/lib/axios";
import type { FavoriteTargetType, MyFavorites } from "@/types";

export const favoriteApi = {
  toggle: (targetType: FavoriteTargetType, targetId: string) =>
    api
      .post<{ favorited: boolean }>("/favorites/toggle", { targetType, targetId })
      .then((r) => r.data),

  myIds: (targetType: FavoriteTargetType) =>
    api
      .get<string[]>("/favorites/mine/ids", { params: { targetType } })
      .then((r) => r.data),

  mine: () => api.get<MyFavorites>("/favorites/mine").then((r) => r.data),
};
