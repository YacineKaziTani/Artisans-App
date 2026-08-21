import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { photoApi } from "@/api/photo.api";

export const photoKeys = {
  mine: ["photos", "mine"] as const,
};

export function useMyPhotos() {
  return useQuery({
    queryKey: photoKeys.mine,
    queryFn: photoApi.mine,
  });
}

export function useUploadPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, caption }: { file: File; caption?: string }) =>
      photoApi.upload(file, caption),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: photoKeys.mine });
    },
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => photoApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: photoKeys.mine });
    },
  });
}
