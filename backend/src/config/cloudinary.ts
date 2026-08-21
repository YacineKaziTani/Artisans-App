import { v2 as cloudinary } from "cloudinary";
// Using a version-agnostic require pattern to solve the "is not a constructor" error
const multerStorage = require("multer-storage-cloudinary");
const CloudinaryStorage = multerStorage.CloudinaryStorage || multerStorage;
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "artisan_app",
    allowed_formats: ["jpg", "png", "jpeg"],
  } as any,
});
export const parser = multer({ storage: storage });
