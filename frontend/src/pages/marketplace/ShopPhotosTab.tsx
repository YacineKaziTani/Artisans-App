import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDeletePhoto, useMyPhotos, useUploadPhoto } from "@/hooks/usePhotos";

export function ShopPhotosTab() {
  const { data: photos, isLoading, isError } = useMyPhotos();
  const uploadPhoto = useUploadPhoto();
  const deletePhoto = useDeletePhoto();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadPhoto.mutate({ file });
    e.target.value = "";
  };

  const handleDelete = (id: string) => {
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
        {uploadPhoto.isError && (
          <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
            Couldn't upload that photo. Please try again.
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
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
            Couldn't load your photos right now.
          </p>
        )}

        {!isLoading && !isError && (photos ?? []).length === 0 && (
          <p className="text-gray-600 text-sm">No photos yet.</p>
        )}

        {!isLoading && !isError && (photos ?? []).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {photos!.map((photo) => (
              <div key={photo.id} className="relative group">
                <img
                  src={photo.url}
                  alt={photo.caption ?? ""}
                  className="w-full aspect-square object-cover rounded-lg border border-gray-200"
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
