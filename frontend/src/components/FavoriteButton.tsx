import { Heart } from "lucide-react";
import { useToggleFavorite } from "@/hooks/useFavorites";
import { useAuthStore } from "@/store/auth.store";
import type { FavoriteTargetType } from "@/types";

export function FavoriteButton({
  targetType,
  targetId,
  isFavorited,
  className = "",
}: {
  targetType: FavoriteTargetType;
  targetId: string;
  isFavorited: boolean;
  className?: string;
}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const toggle = useToggleFavorite(targetType);

  if (!isAuthenticated) return null;

  return (
    <button
      type="button"
      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={isFavorited}
      disabled={toggle.isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate(targetId);
      }}
      className={`inline-flex items-center justify-center rounded-full p-1.5 transition-all hover:scale-110 disabled:opacity-50 ${
        isFavorited
          ? "text-rose-500"
          : "text-muted-foreground hover:text-rose-500"
      } ${className}`}
    >
      <Heart className={`size-[18px] ${isFavorited ? "fill-current" : ""}`} />
    </button>
  );
}
