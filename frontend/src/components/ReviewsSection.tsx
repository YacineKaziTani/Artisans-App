import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateReview,
  useDeleteReview,
  useShopReviews,
} from "@/hooks/useReviews";
import { useAuthStore } from "@/store/auth.store";
import { ReportDialog } from "@/components/ReportDialog";

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`text-2xl leading-none ${n <= value ? "text-amber-500" : "text-muted-foreground/50"}`}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500 text-sm">
      {"★".repeat(Math.round(rating))}
      <span className="text-muted-foreground/50">{"★".repeat(5 - Math.round(rating))}</span>
    </span>
  );
}

export function ReviewsSection({ shopId }: { shopId: string }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: reviews, isLoading, isError } = useShopReviews(shopId);
  const createReview = useCreateReview(shopId);
  const deleteReview = useDeleteReview(shopId);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);

  const myReview = reviews?.find((r) => r.author?.id === user?.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createReview.mutate(
      { rating, comment: comment || undefined },
      {
        onSuccess: () => {
          setComment("");
          setRating(5);
          setShowForm(false);
        },
      },
    );
  };

  return (
    <div className="mt-12">
      <h2 className="text-3xl font-bold text-foreground mb-6">Reviews</h2>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-destructive bg-destructive/10 border border-destructive/25 rounded-lg p-4">
          Couldn't load reviews right now.
        </p>
      )}

      {!isLoading && !isError && (reviews ?? []).length === 0 && (
        <p className="text-foreground/80 bg-white/70 border border-border rounded-xl p-6 mb-6">
          No reviews yet.
        </p>
      )}

      {!isLoading && !isError && (reviews ?? []).length > 0 && (
        <div className="space-y-4 mb-6">
          {reviews!.map((review) => (
            <div
              key={review.id}
              className="bg-card border border-border rounded-xl p-5"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-semibold text-foreground">
                    {review.author?.name ?? "Anonymous"}
                  </p>
                  <Stars rating={review.rating} />
                </div>
                {review.author?.id === user?.id ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={deleteReview.isPending}
                    onClick={() => deleteReview.mutate(review.id)}
                  >
                    Delete
                  </Button>
                ) : (
                  isAuthenticated && (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                      onClick={() => setReportingReviewId(review.id)}
                    >
                      Report
                    </button>
                  )
                )}
              </div>
              {review.comment && (
                <p className="text-foreground/80 text-sm mt-2">{review.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {isAuthenticated && !myReview && (
        <>
          {!showForm ? (
            <Button variant="outline" onClick={() => setShowForm(true)}>
              Leave a Review
            </Button>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="bg-card border border-border rounded-xl p-5 space-y-4"
            >
              {createReview.isError && (
                <div className="p-3 bg-destructive/10 border border-destructive/25 rounded-lg text-destructive text-sm">
                  Couldn't submit your review. Please try again.
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Rating</p>
                <StarPicker value={rating} onChange={setRating} />
              </div>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience (optional)"
                rows={3}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={createReview.isPending}>
                  {createReview.isPending ? "Submitting..." : "Submit Review"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </>
      )}

      {!isAuthenticated && (
        <p className="text-sm text-muted-foreground">
          Log in to leave a review.
        </p>
      )}

      {reportingReviewId && (
        <ReportDialog
          targetType="review"
          targetId={reportingReviewId}
          open={Boolean(reportingReviewId)}
          onOpenChange={(open) => {
            if (!open) setReportingReviewId(null);
          }}
        />
      )}
    </div>
  );
}
