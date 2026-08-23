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
      disabled={toggle.isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate(targetId);
      }}
      className={`text-xl leading-none transition-transform hover:scale-110 ${className}`}
    >
      {isFavorited ? "❤️" : "🤍"}
    </button>
  );
}
