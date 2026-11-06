// /sitemap.xml (rewritten here by vercel.json): every public page, from the API.
import { apiBase, renderSitemap, type SitemapData } from "./_seo";

export async function GET(request: Request) {
  const site = new URL(request.url).origin;
  let data: SitemapData = { shops: [], products: [], categories: [] };
  try {
    const api = apiBase(process.env);
    if (api) {
      const res = await fetch(`${api}/seo/sitemap`);
      if (res.ok) data = await res.json();
    }
  } catch {
    // Serve the static pages at least.
  }
  return new Response(renderSitemap(data, site), {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
