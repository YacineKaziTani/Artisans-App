// Uploads are stored at their original size (often several MB from a
// phone). Cloudinary resizes and re-encodes on the fly from the URL, so each
// place asks for the width it actually shows — in WebP/AVIF where the
// browser supports it — instead of downloading the original every time.

const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

/** A Cloudinary URL resized to `width` CSS pixels × `density`; other URLs unchanged. */
export function cloudinaryUrl(url: string, width: number, density = 1) {
  const match = url.match(CLOUDINARY_UPLOAD);
  if (!match) return url;
  const w = Math.round(width * density);
  return `${match[1]}f_auto,q_auto,c_limit,w_${w}/${match[2]}`;
}

/**
 * Props for an <img> shown `width` CSS pixels wide: a right-sized `src`
 * plus a 2× version for sharp screens. Spread it: `<img {...img(url, 400)} />`.
 * Non-Cloudinary URLs (external icons, local previews) pass through as-is.
 */
export function img(url: string | null | undefined, width: number) {
  if (!url) return { src: undefined };
  if (!CLOUDINARY_UPLOAD.test(url)) return { src: url };
  return {
    src: cloudinaryUrl(url, width),
    srcSet: `${cloudinaryUrl(url, width)} 1x, ${cloudinaryUrl(url, width, 2)} 2x`,
    decoding: "async" as const,
  };
}
