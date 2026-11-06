// Link previews for products and shops. vercel.json sends only link-preview
// bots here (they don't run JavaScript); people get the normal app.
import { apiBase, productSharePage, renderSharePage, shopSharePage, SITE_NAME } from "./_seo";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const site = url.origin;
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id") ?? "";
  const html = (body: string) =>
    new Response(body, {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=600" },
    });
  const fallback = () =>
    html(renderSharePage({ title: SITE_NAME, description: "", path: "/", type: "website" }, site));

  const api = apiBase(process.env);
  if (!api || !UUID.test(id) || (type !== "product" && type !== "shop")) return fallback();

  try {
    const res = await fetch(`${api}/${type === "product" ? "products" : "shops"}/${id}`);
    if (!res.ok) return fallback();
    const data = await res.json();
    return html(renderSharePage(type === "product" ? productSharePage(data) : shopSharePage(data), site));
  } catch {
    return fallback();
  }
}
