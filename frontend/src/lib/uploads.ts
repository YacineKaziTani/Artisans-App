/** Matches the API's upload limit (multer, 5 MB). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/jpg";

export const IMAGE_TOO_LARGE_MESSAGE =
  "That image is over 5 MB — please choose a smaller one.";

export function isImageTooLarge(file: File | null | undefined) {
  return Boolean(file && file.size > MAX_IMAGE_BYTES);
}
