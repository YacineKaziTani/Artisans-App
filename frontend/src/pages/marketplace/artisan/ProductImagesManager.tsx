import { MAX_IMAGE_BYTES } from "@/lib/uploads";
import { useRef, useState } from "react";
import { useAddProductImage, useRemoveProductImage } from "@/hooks/useProducts";
import { useConfirm } from "@/hooks/useConfirm";
import { getErrorMessage } from "@/lib/errors";
import type { Product, ProductImage } from "@/types";
import { img } from "@/lib/images";


export function ProductImagesManager({ product }: { product: Product }) {
  const addImage = useAddProductImage();
  const removeImage = useRemoveProductImage();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sizeError, setSizeError] = useState(false);
  const error = addImage.error ?? removeImage.error;

  const handleRemove = async (image: ProductImage) => {
    const ok = await confirm({
      title: "Remove this photo?",
      confirmLabel: "Remove photo",
      destructive: true,
    });
    if (ok) removeImage.mutate(image.id);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto">
        {(product.images ?? []).map((image) => (
          <div key={image.id} className="relative flex-shrink-0">
            <img
              {...img(image.url, 64)}
              alt=""
              className="w-16 h-16 object-cover rounded-md border border-border"
            />
            <button
              type="button"
              aria-label="Remove photo"
              className="absolute -top-1 -right-1 bg-card rounded-full w-5 h-5 text-xs border border-border shadow-[var(--shadow-sm)]"
              disabled={removeImage.isPending}
              onClick={() => handleRemove(image)}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          aria-label="Add photo"
          onClick={() => fileInputRef.current?.click()}
          disabled={addImage.isPending}
          className="w-16 h-16 flex-shrink-0 rounded-md border border-dashed border-border text-muted-foreground/70 text-2xl flex items-center justify-center hover:border-primary/40"
        >
          {addImage.isPending ? "…" : "+"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            addImage.reset();
            setSizeError(file.size > MAX_IMAGE_BYTES);
            if (file.size > MAX_IMAGE_BYTES) return;
            addImage.mutate({ id: product.id, file });
          }}
        />
      </div>
      {sizeError && (
        <p className="text-xs text-destructive">
          That image is over 5 MB — please choose a smaller one.
        </p>
      )}
      {Boolean(error) && (
        <p className="text-xs text-destructive">
          {getErrorMessage(error, "Couldn't update the photos. Please try again.")}
        </p>
      )}
    </div>
  );
}
