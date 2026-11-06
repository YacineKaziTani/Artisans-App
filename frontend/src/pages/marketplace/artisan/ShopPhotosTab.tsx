import { MAX_IMAGE_BYTES } from "@/lib/uploads";
import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDeletePhoto, useMyPhotos, useUploadPhoto } from "@/hooks/usePhotos";
import { useConfirm } from "@/hooks/useConfirm";
import { getErrorMessage } from "@/lib/errors";
import { img } from "@/lib/images";


export function ShopPhotosTab() {
  const { data: photos, isLoading, isError } = useMyPhotos();
  const uploadPhoto = useUploadPhoto();
  const deletePhoto = useDeletePhoto();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tooLarge, setTooLarge] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const error = uploadPhoto.error ?? deletePhoto.error;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    uploadPhoto.reset();
    setTooLarge(file.size > MAX_IMAGE_BYTES);
    if (file.size > MAX_IMAGE_BYTES) return;
    uploadPhoto.mutate({ file });
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete this photo?",
      description: "It's removed from your public shop page.",
      confirmLabel: "Delete photo",
      destructive: true,
    });
    if (!ok) return;
    setPendingDeleteId(id);
    deletePhoto.mutate(id, { onSettled: () => setPendingDeleteId(null) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shop Photos</CardTitle>
        <CardDescription>
          Show off your work — photos appear on your public shop page
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {tooLarge && (
          <div className="alert-error">
            That image is over 5 MB — please choose a smaller one.
          </div>
        )}
        {Boolean(error) && (
          <div className="alert-error">
            {getErrorMessage(error, "Couldn't update your photos. Please try again.")}
          </div>
        )}

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadPhoto.isPending}
          >
            {uploadPhoto.isPending ? "Uploading..." : "Upload Photo"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">JPG or PNG, up to 5 MB.</p>
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-destructive bg-destructive/10 border border-destructive/25 rounded-lg p-4 text-sm">
            Couldn't load your photos right now.
          </p>
        )}

        {!isLoading && !isError && (photos ?? []).length === 0 && (
          <p className="text-muted-foreground text-sm">No photos yet.</p>
        )}

        {!isLoading && !isError && (photos ?? []).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {photos!.map((photo) => (
              <div key={photo.id} className="relative group">
                <img
                  {...img(photo.url, 300)}
                  alt={photo.caption ?? ""}
                  className="w-full aspect-square object-cover rounded-lg border border-border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2 opacity-90"
                  disabled={pendingDeleteId === photo.id}
                  onClick={() => handleDelete(photo.id)}
                >
                  {pendingDeleteId === photo.id ? "…" : "Delete"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
