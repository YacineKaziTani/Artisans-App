import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";

const MAX_URLS = 45_000; // a sitemap file holds at most 50,000

/**
 * GET /seo/sitemap — every public page's id and last change, for the
 * frontend's sitemap.xml. Only what anonymous visitors can see: active
 * shops, their live products, active categories.
 */
export const getSitemapData = async (_req: Request, res: Response) => {
  try {
    const [shops, products, categories] = await Promise.all([
      AppDataSource.query(
        `SELECT id, "updatedAt" FROM shops WHERE status = 'active' ORDER BY "updatedAt" DESC LIMIT $1`,
        [MAX_URLS],
      ),
      AppDataSource.query(
        `SELECT p.id, p."updatedAt" FROM products p JOIN shops s ON s.id = p."shopId"
          WHERE s.status = 'active' AND p."archivedAt" IS NULL
          ORDER BY p."updatedAt" DESC LIMIT $1`,
        [MAX_URLS],
      ),
      AppDataSource.query(`SELECT id FROM categories WHERE "isActive" = true`),
    ]);
    res.set("Cache-Control", "public, max-age=3600");
    return res.json({ shops, products, categories });
  } catch (error) {
    console.error("getSitemapData failed:", error);
    return res.status(500).json({ message: "Couldn't build the sitemap" });
  }
};
