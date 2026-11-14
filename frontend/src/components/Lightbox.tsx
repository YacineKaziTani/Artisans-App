import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { img } from "@/lib/images";

/**
 * Full-screen photo viewer: arrows / swipe-free buttons / keyboard to move
 * between photos, click (or the zoom button) to zoom in 2.5× where you
 * pointed, then move the pointer to look around.
 */
export function Lightbox({
  images,
  index,
  onIndexChange,
  onClose,
  alt,
}: {
  images: string[];
  /** Which photo is open; null = closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  alt: string;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const open = index !== null && images.length > 0;
  const current = open ? images[Math.min(index, images.length - 1)] : null;
  const many = images.length > 1;

  const go = (delta: number) => {
    if (index === null) return;
    setZoomed(false);
    onIndexChange((index + delta + images.length) % images.length);
  };

  const pointAt = (e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x}% ${y}%`);
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setZoomed(false);
          onClose();
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay data-slot="dialog-overlay" className="fixed inset-0 z-50 bg-black/90" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center outline-none"
          onKeyDown={(e) => {
            if (!many) return;
            if (e.key === "ArrowRight") go(1);
            if (e.key === "ArrowLeft") go(-1);
          }}
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            {alt}
            {many && index !== null ? ` — photo ${index + 1} of ${images.length}` : ""}
          </DialogPrimitive.Title>

          {current && (
            <div
              className={`flex size-full items-center justify-center overflow-hidden p-4 sm:p-12 ${zoomed ? "cursor-zoom-out" : "cursor-zoom-in"}`}
              onClick={() => setZoomed((z) => !z)}
              onPointerMove={zoomed ? pointAt : undefined}
              onPointerDown={pointAt}
            >
              <img
                {...img(current, 1600)}
                alt={alt}
                className="max-h-full max-w-full select-none object-contain transition-transform duration-200"
                style={{ transform: zoomed ? "scale(2.5)" : undefined, transformOrigin: origin }}
                draggable={false}
              />
            </div>
          )}

          <div className="absolute top-4 right-4 flex gap-2">
            <button
              type="button"
              onClick={() => setZoomed((z) => !z)}
              className="rounded-full bg-white/10 p-2.5 text-white backdrop-blur hover:bg-white/20"
              aria-label={zoomed ? "Zoom out" : "Zoom in"}
            >
              {zoomed ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}
            </button>
            <DialogPrimitive.Close
              className="rounded-full bg-white/10 p-2.5 text-white backdrop-blur hover:bg-white/20"
              aria-label="Close"
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>

          {many && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur hover:bg-white/20"
                aria-label="Previous photo"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur hover:bg-white/20"
                aria-label="Next photo"
              >
                <ChevronRight className="size-6" />
              </button>
              <p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white backdrop-blur">
                {(index ?? 0) + 1} / {images.length}
              </p>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
