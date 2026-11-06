import { useEffect, useMemo, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useAddReviewPhoto,
  useCreateReview,
  useDeleteReview,
  useRemoveReviewPhoto,
  useReplyToReview,
  useReviewEligibility,
  useShopReviews,
  useUpdateReview,
} from "@/hooks/useReviews";
import { useAuthStore } from "@/store/auth.store";
import { ReportDialog } from "@/components/ReportDialog";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { useConfirm } from "@/hooks/useConfirm";
import { getErrorMessage } from "@/lib/errors";
import { img } from "@/lib/images";
import { IMAGE_ACCEPT, IMAGE_TOO_LARGE_MESSAGE, isImageTooLarge } from "@/lib/uploads";
import type { Review } from "@/types";

const MAX_PHOTOS = 3;

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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

/** Thumbnails of files picked but not uploaded yet. */
function PendingPhotos({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return (
    <>
      {urls.map((url, i) => (
        <span key={url} className="relative">
          <img src={url} alt="" className="size-20 rounded-lg border border-border object-cover" />
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`Remove photo ${i + 1}`}
            className="absolute -right-1.5 -top-1.5 rounded-full bg-card p-0.5 shadow"
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
    </>
  );
}

/** Rating, comment, product and photos — used both to write and to edit a review. */
function ReviewForm({
  initial,
  shopId,
  products,
  submitLabel,
  pendingLabel,
  isPending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Review;
  shopId: string;
  /** Products the client received from this shop (what the review can be about). */
  products: { id: string; title: string }[];
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  error: unknown;
  onSubmit: (payload: { rating: number; comment?: string; productId?: string | null; photos: File[] }) => void;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState(initial?.rating ?? 5);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [productId, setProductId] = useState(initial?.product?.id ?? "");
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [tooLarge, setTooLarge] = useState(false);
  const removePhoto = useRemoveReviewPhoto(shopId);
  const addPhoto = useAddReviewPhoto(shopId);

  const existing = initial?.photos ?? [];
  const room = MAX_PHOTOS - existing.length - newPhotos.length;
  // When editing, the current tag stays selectable even if it's not in the list.
  const productOptions =
    initial?.product && !products.some((p) => p.id === initial.product!.id)
      ? [initial.product, ...products]
      : products;

  const pickPhotos = (files: FileList | null) => {
    const picked = Array.from(files ?? []).slice(0, Math.max(0, room));
    setTooLarge(picked.some(isImageTooLarge));
    const ok = picked.filter((f) => !isImageTooLarge(f));
    // Editing: upload right away. Writing: send with the review.
    if (initial) ok.forEach((file) => addPhoto.mutate({ id: initial.id, file }));
    else setNewPhotos((current) => [...current, ...ok]);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          rating,
          comment: comment.trim(),
          productId: initial ? productId || null : productId || undefined,
          photos: newPhotos,
        });
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

      {productOptions.length > 0 && (
        <div>
          <label htmlFor={`review-product-${initial?.id ?? "new"}`} className="text-sm font-medium text-foreground">
            What is it about? <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <select
            id={`review-product-${initial?.id ?? "new"}`}
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">The shop in general</option>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
      )}

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your experience (optional)"
        aria-label="Your review"
        maxLength={2000}
        rows={3}
      />

      <div>
        <p className="text-sm font-medium text-foreground">
          Photos <span className="font-normal text-muted-foreground">(up to {MAX_PHOTOS})</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {existing.map((photo, i) => (
            <span key={photo.publicId} className="relative">
              <img {...img(photo.url, 80)} alt="" className="size-20 rounded-lg border border-border object-cover" />
              <button
                type="button"
                disabled={removePhoto.isPending}
                onClick={() => removePhoto.mutate({ id: initial!.id, index: i })}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-card p-0.5 shadow"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          <PendingPhotos files={newPhotos} onRemove={(i) => setNewPhotos((f) => f.filter((_, j) => j !== i))} />
          {room > 0 && (
            <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/40">
              <ImagePlus className="size-5" aria-hidden="true" />
              {addPhoto.isPending ? "Uploading…" : "Add"}
              <input
                type="file"
                accept={IMAGE_ACCEPT}
                multiple
                className="sr-only"
                onChange={(e) => {
                  pickPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        {tooLarge && <p className="mt-1 text-xs text-destructive">{IMAGE_TOO_LARGE_MESSAGE}</p>}
        {(addPhoto.isError || removePhoto.isError) && (
          <p className="mt-1 text-xs text-destructive">
            {getErrorMessage(addPhoto.error ?? removePhoto.error, "Couldn't update the photos.")}
          </p>
        )}
      </div>

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

/** The shop owner's reply box under a review. */
function ReplyForm({ review, shopId }: { review: Review; shopId: string }) {
  const reply = useReplyToReview(shopId);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(review.reply ?? "");

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setText(review.reply ?? "");
          setEditing(true);
        }}
        className="mt-3 text-xs font-medium text-primary hover:underline"
      >
        {review.reply ? "Edit your reply" : "Reply publicly"}
      </button>
    );
  }
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        reply.mutate({ id: review.id, reply: text.trim() }, { onSuccess: () => setEditing(false) });
      }}
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        rows={2}
        aria-label="Your reply"
        placeholder="Thank them, or answer their point — everyone can see this."
      />
      {reply.isError && <p className="text-xs text-destructive">{getErrorMessage(reply.error)}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={reply.isPending}>
          {reply.isPending ? "Saving…" : text.trim() ? "Post reply" : "Remove reply"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ReviewsSection({
  shopId,
  shopName,
  ownerId,
}: {
  shopId: string;
  shopName?: string;
  /** The shop owner can reply to reviews. */
  ownerId?: string;
}) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: reviews, isLoading, isError } = useShopReviews(shopId);
  const { data: eligibility } = useReviewEligibility(shopId, { enabled: isAuthenticated });
  const createReview = useCreateReview(shopId);
  const updateReview = useUpdateReview(shopId);
  const deleteReview = useDeleteReview(shopId);
  const confirm = useConfirm();
  const isOwner = Boolean(user && ownerId && user.id === ownerId);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);

  const handleDelete = async (review: Review) => {
    const ok = await confirm({
      title: "Delete your review?",
      description: "This removes your rating, comment and photos from the shop.",
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
        <p className="text-foreground/80 bg-card border border-border rounded-xl p-6 mb-6">No reviews yet.</p>
      )}

      {deleteReview.isError && (
        <p className="alert-error mb-4">{getErrorMessage(deleteReview.error, "Couldn't delete your review.")}</p>
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
                  shopId={shopId}
                  products={eligibility?.products ?? []}
                  submitLabel="Save changes"
                  pendingLabel="Saving..."
                  isPending={updateReview.isPending}
                  error={updateReview.error}
                  // Photos are uploaded as they're picked when editing.
                  onSubmit={({ rating, comment, productId }) =>
                    updateReview.mutate(
                      { id: review.id, payload: { rating, comment, productId } },
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
              <ReviewCard
                key={review.id}
                review={review}
                shopName={shopName}
                actions={
                  mine ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingId(review.id)}>
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
                  )
                }
                footer={isOwner ? <ReplyForm review={review} shopId={shopId} /> : undefined}
              />
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
              shopId={shopId}
              products={eligibility.products ?? []}
              submitLabel="Submit Review"
              pendingLabel="Submitting..."
              isPending={createReview.isPending}
              error={createReview.error}
              onSubmit={(payload) => createReview.mutate(payload, { onSuccess: () => setShowForm(false) })}
              onCancel={() => {
                createReview.reset();
                setShowForm(false);
              }}
            />
          )}
        </>
      )}

      {isAuthenticated && eligibility && !eligibility.canReview && eligibility.reason === "no_completed_purchase" && (
        <p className="text-sm text-muted-foreground">{eligibility.message}</p>
      )}

      {!isAuthenticated && <p className="text-sm text-muted-foreground">Log in to leave a review.</p>}

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
