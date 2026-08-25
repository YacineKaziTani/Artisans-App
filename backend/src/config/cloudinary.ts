import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  // multer-storage-cloudinary's types don't know about the newer keys added
  // to the installed cloudinary package's UploadApiOptions (its `KnownKeys`
  // helper collapses to `never` once that interface gained a catch-all index
  // signature) — this is a type-only mismatch, not a runtime one; the
  // library just spreads these into the upload call.
  params: {
    folder: "artisan_app",
    allowed_formats: ["jpg", "png", "jpeg"],
  } as CloudinaryStorage["params"],
});

export const parser = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
