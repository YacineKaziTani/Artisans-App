// Pure helpers for the SEO functions (files starting with "_" aren't routes
// on Vercel). Kept free of Vercel/Node specifics so they can be tested.

export const SITE_NAME = "Artisan Market";
const DEFAULT_DESCRIPTION = "Handmade goods and skilled makers — buy from and book local artisans.";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** One line, at most `max` characters, for meta descriptions. */
export function summarize(text: string | null | undefined, max = 160) {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** A Cloudinary image cropped to the 1200×630 JPEG link previews expect. */
export function previewImage(url: string | null | undefined) {
  if (!url) return null;
  const m = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/);
  return m ? `${m[1]}c_fill,w_1200,h_630,f_jpg,q_auto/${m[2]}` : url;
}

export interface SharePage {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type: "product" | "profile" | "website";
  /** schema.org data for search engines. */
  jsonLd?: Record<string, unknown>;
}

/** The small HTML page link-preview bots read (they don't run JavaScript). */
export function renderSharePage(page: SharePage, siteUrl: string) {
  const url = `${siteUrl}${page.path}`;
  const title = page.title === SITE_NAME ? SITE_NAME : `${page.title} | ${SITE_NAME}`;
  const description = page.description || DEFAULT_DESCRIPTION;
  const meta = [
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:type" content="${page.type}">`,
    `<meta property="og:title" content="${escapeHtml(page.title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    page.image ? `<meta property="og:image" content="${escapeHtml(page.image)}">` : "",
    `<meta name="twitter:card" content="${page.image ? "summary_large_image" : "summary"}">`,
    page.jsonLd
      ? // "<" escaped so text inside can't close the script tag.
        `<script type="application/ld+json">${JSON.stringify(page.jsonLd).replace(/</g, "\\u003c")}</script>`
      : "",
  ].filter(Boolean);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${meta.join("\n")}
</head>
<body>
<h1>${escapeHtml(page.title)}</h1>
<p>${escapeHtml(description)}</p>
<p><a href="${escapeHtml(url)}">Open on ${SITE_NAME}</a></p>
</body>
</html>`;
}

interface ProductData {
  id: string;
  title: string;
  description?: string | null;
  basePrice: string | number;
  imageUrl?: string | null;
  images?: { url: string }[];
  stockQuantity?: number | null;
  shop?: { id: string; shopName: string } | null;
}

export function productSharePage(p: ProductData): SharePage {
  const image = previewImage(p.images?.[0]?.url ?? p.imageUrl);
  const shopName = p.shop?.shopName;
  return {
    title: shopName ? `${p.title} by ${shopName}` : p.title,
    description: summarize(p.description) || `${p.title} — handmade${shopName ? ` by ${shopName}` : ""}.`,
    path: `/product/${p.id}`,
    image,
    type: "product",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.title,
      description: summarize(p.description, 500) || undefined,
      image: image ? [image] : undefined,
      brand: shopName ? { "@type": "Brand", name: shopName } : undefined,
      offers: {
        "@type": "Offer",
        price: Number(p.basePrice).toFixed(2),
        priceCurrency: "USD",
        availability:
          p.stockQuantity === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      },
    },
  };
}

interface ShopData {
  id: string;
  shopName: string;
  description?: string | null;
  city?: string | null;
  logoUrl?: string | null;
  photos?: { url: string }[];
}

export function shopSharePage(s: ShopData): SharePage {
  return {
    title: s.city ? `${s.shopName} — artisan in ${s.city}` : s.shopName,
    description: summarize(s.description) || `Handmade work by ${s.shopName}.`,
    path: `/artisan/${s.id}`,
    image: previewImage(s.photos?.[0]?.url ?? s.logoUrl),
    type: "profile",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: s.shopName,
      description: summarize(s.description, 500) || undefined,
      address: s.city ? { "@type": "PostalAddress", addressLocality: s.city } : undefined,
    },
  };
}

export interface SitemapData {
  shops: { id: string; updatedAt: string }[];
  products: { id: string; updatedAt: string }[];
  categories: { id: string }[];
}

const STATIC_PATHS = ["/", "/products", "/categories", "/help", "/sell", "/terms", "/privacy", "/refund-policy"];

export function renderSitemap(data: SitemapData, siteUrl: string) {
  const entry = (path: string, lastmod?: string) =>
    `  <url><loc>${escapeHtml(siteUrl + path)}</loc>${
      lastmod ? `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : ""
    }</url>`;
  const urls = [
    ...STATIC_PATHS.map((p) => entry(p)),
    ...data.categories.map((c) => entry(`/category/${c.id}`)),
    ...data.shops.map((s) => entry(`/artisan/${s.id}`, s.updatedAt)),
    ...data.products.map((p) => entry(`/product/${p.id}`, p.updatedAt)),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}

export function renderRobots(siteUrl: string) {
  return `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /profile-client
Disallow: /profile-artisan
Disallow: /messages
Disallow: /cart
Disallow: /favorites
Disallow: /verify-email
Disallow: /reset-password

Sitemap: ${siteUrl}/sitemap.xml
`;
}

/** The backend base URL ("https://api.example.com/api"), from the same variable the app uses. */
export function apiBase(env: Record<string, string | undefined>) {
  return (env.API_URL || env.VITE_API_URL || "").replace(/\/+$/, "");
}
