import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateReview,
  useDeleteReview,
  useReviewEligibility,
  useShopReviews,
  useUpdateReview,
} from "@/hooks/useReviews";
import { useAuthStore } from "@/store/auth.store";
import { ReportDialog } from "@/components/ReportDialog";
import { useConfirm } from "@/hooks/useConfirm";
import { getErrorMessage } from "@/lib/errors";
import type { Review } from "@/types";

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
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
    <span className="text-amber-500 text-sm" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(Math.round(rating))}
      <span className="text-muted-foreground/50">{"★".repeat(5 - Math.round(rating))}</span>
    </span>
  );
}

/** Rating + comment form, used both to write and to edit a review. */
function ReviewForm({
  initial,
  submitLabel,
  pendingLabel,
  isPending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Review;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  error: unknown;
  onSubmit: (payload: { rating: number; comment?: string }) => void;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState(initial?.rating ?? 5);
  const [comment, setComment] = useState(initial?.comment ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ rating, comment: comment.trim() });
      }}
      className="bg-card border border-border rounded-xl p-5 space-y-4"
    >
      {Boolean(error) && (
        <div className="p-3 bg-destructive/10 border border-destructive/25 rounded-lg text-destructive text-sm">
          {getErrorMessage(error, "Couldn't save your review. Please try again.")}
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
        maxLength={2000}
        rows={3}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? pendingLabel : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ReviewsSection({ shopId }: { shopId: string }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: reviews, isLoading, isError } = useShopReviews(shopId);
  const { data: eligibility } = useReviewEligibility(shopId, {
    enabled: isAuthenticated,
  });
  const createReview = useCreateReview(shopId);
  const updateReview = useUpdateReview(shopId);
  const deleteReview = useDeleteReview(shopId);
  const confirm = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);

  const handleDelete = async (review: Review) => {
    const ok = await confirm({
      title: "Delete your review?",
      description: "This removes your rating and comment from the shop.",
      confirmLabel: "Delete review",
      destructive: true,
    });
    if (ok) deleteReview.mutate(review.id);
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
        <p className="text-foreground/80 bg-card border border-border rounded-xl p-6 mb-6">
          No reviews yet.
        </p>
      )}

      {deleteReview.isError && (
        <p className="alert-error mb-4">
          {getErrorMessage(deleteReview.error, "Couldn't delete your review.")}
        </p>
      )}

      {!isLoading && !isError && (reviews ?? []).length > 0 && (
        <div className="space-y-4 mb-6">
          {reviews!.map((review) => {
            const mine = review.author?.id === user?.id;

            if (mine && editingId === review.id) {
              return (
                <ReviewForm
                  key={review.id}
                  initial={review}
                  submitLabel="Save changes"
                  pendingLabel="Saving..."
                  isPending={updateReview.isPending}
                  error={updateReview.error}
                  onSubmit={(payload) =>
                    updateReview.mutate(
                      { id: review.id, payload },
                      { onSuccess: () => setEditingId(null) },
                    )
                  }
                  onCancel={() => {
                    updateReview.reset();
                    setEditingId(null);
                  }}
                />
              );
            }

            return (
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
                  {mine ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(review.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={deleteReview.isPending}
                        onClick={() => handleDelete(review)}
                      >
                        Delete
                      </Button>
                    </div>
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
            );
          })}
        </div>
      )}

      {/* Only clients who completed a booking or received an order can
          review; everyone else gets told why the form isn't there. */}
      {isAuthenticated && eligibility?.canReview && (
        <>
          {!showForm ? (
            <Button variant="outline" onClick={() => setShowForm(true)}>
              Leave a Review
            </Button>
          ) : (
            <ReviewForm
              submitLabel="Submit Review"
              pendingLabel="Submitting..."
              isPending={createReview.isPending}
              error={createReview.error}
              onSubmit={(payload) =>
                createReview.mutate(payload, {
                  onSuccess: () => setShowForm(false),
                })
              }
              onCancel={() => {
                createReview.reset();
                setShowForm(false);
              }}
            />
          )}
        </>
      )}

      {isAuthenticated &&
        eligibility &&
        !eligibility.canReview &&
        eligibility.reason === "no_completed_purchase" && (
          <p className="text-sm text-muted-foreground">{eligibility.message}</p>
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
