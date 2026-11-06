import { v2 as cloudinary } from "cloudinary";

/** A file multer-storage-cloudinary has already uploaded (`filename` = public id). */
export interface CloudinaryFile extends Omit<Express.Multer.File, "filename"> {
  filename?: string;
}

/** Best-effort removal of an uploaded image we no longer reference. */
export async function destroyUpload(publicId: string | undefined | null) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn("[cloudinary] couldn't delete", publicId, err);
  }
}
