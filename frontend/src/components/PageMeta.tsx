const SITE_NAME = "Artisan Market";

/**
 * The page's <title> and description. React 19 moves these into <head>.
 * Search engines that run JavaScript (Google) read them; link-preview bots
 * get the server-rendered versions from /api/share instead.
 */
export function PageMeta({
  title,
  description,
  jsonLd,
}: {
  /** Without the site name — it's appended. */
  title?: string;
  description?: string;
  /** schema.org data, e.g. a Product, for rich search results. */
  jsonLd?: Record<string, unknown>;
}) {
  return (
    <>
      <title>{title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Handmade Goods & Skilled Makers`}</title>
      {description && <meta name="description" content={description.replace(/\s+/g, " ").trim().slice(0, 160)} />}
      {jsonLd && (
        <script
          type="application/ld+json"
          // "<" escaped so user text can't close the tag.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
    </>
  );
}
