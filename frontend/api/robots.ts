// /robots.txt (rewritten here by vercel.json), pointing crawlers at the sitemap.
import { renderRobots } from "./_seo";

export function GET(request: Request) {
  return new Response(renderRobots(new URL(request.url).origin), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" },
  });
}
