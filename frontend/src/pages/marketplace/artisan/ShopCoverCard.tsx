import { useRef } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRemoveShopCover, useUploadShopCover } from "@/hooks/useShops";
import { useConfirm } from "@/hooks/useConfirm";
import { getErrorMessage } from "@/lib/errors";
import { img } from "@/lib/images";
import { IMAGE_ACCEPT, IMAGE_TOO_LARGE_MESSAGE, isImageTooLarge } from "@/lib/uploads";
import { toast } from "@/lib/toast";
import type { Shop } from "@/types";

/** The wide banner at the top of the public shop page. */
export function ShopCoverCard({ shop }: { shop: Shop }) {
  const upload = useUploadShopCover();
  const remove = useRemoveShopCover();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const busy = upload.isPending || remove.isPending;

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (isImageTooLarge(file)) {
      toast.error(IMAGE_TOO_LARGE_MESSAGE);
      return;
    }
    upload.mutate(file, {
      onSuccess: () => toast.success("Cover photo updated"),
      onError: (err) => toast.error(getErrorMessage(err, "Couldn't upload that photo.")),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cover photo</CardTitle>
        <CardDescription>
          The banner across the top of your shop page — your workshop, your work, or your materials. A wide photo
          (about 1600 × 600) looks best.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative h-36 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-brand-100 via-secondary to-jade-50 sm:h-48">
          {shop.coverUrl ? (
            <img {...img(shop.coverUrl, 900)} alt="Current cover" className="size-full object-cover" />
          ) : (
            <p className="flex size-full items-center justify-center text-sm text-muted-foreground">No cover photo yet</p>
          )}
          {busy && <div className="skeleton absolute inset-0 rounded-none opacity-70" />}
        </div>
        <input
          ref={input}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            <ImagePlus className="size-4" /> {shop.coverUrl ? "Replace photo" : "Upload photo"}
          </Button>
          {shop.coverUrl && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                const ok = await confirm({ title: "Remove the cover photo?", confirmLabel: "Remove", destructive: true });
                if (ok) {
                  remove.mutate(undefined, {
                    onSuccess: () => toast.success("Cover photo removed"),
                    onError: (err) => toast.error(getErrorMessage(err)),
                  });
                }
              }}
            >
              <Trash2 className="size-4" /> Remove
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
