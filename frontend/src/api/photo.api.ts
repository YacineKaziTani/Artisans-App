import { api } from "@/lib/axios";
import type { Photo } from "@/types";

export const photoApi = {
  mine: () => api.get<Photo[]>("/photos/mine").then((r) => r.data),

  upload: (file: File, caption?: string) => {
    const form = new FormData();
    form.append("image", file);
    if (caption) form.append("caption", caption);
    return api
      .post<Photo>("/photos", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  remove: (id: string) => api.delete(`/photos/${id}`).then((r) => r.data),
};
