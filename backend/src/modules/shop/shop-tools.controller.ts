import { Request, Response } from "express";
import crypto from "crypto";
import { AppDataSource } from "../../data-source";
import { Shop, ownerShopView } from "./shop.entities";
import { buildCalendar } from "../../lib/ics";
import { primaryFrontendUrl } from "../../lib/urls";

const shopRepo = AppDataSource.getRepository(Shop);

function myShop(userId: string) {
  return shopRepo.findOne({ where: { owner: { id: userId } } });
}

// ── Holiday mode ───────────────────────────────────────────────────────────

/**
 * PUT /shops/mine/holiday { until, message } — away until a date (null
 * switches it off). While away: no new orders, bookings only after the
 * return date, and one automatic chat reply per conversation.
 */
export const updateMyHoliday = async (req: Request, res: Response) => {
  try {
    const shop = await myShop(req.user!.id);
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    const { until, message } = req.body as { until: Date | null; message?: string };
    const wasAway = Boolean(shop.holidayUntil && shop.holidayUntil.getTime() > Date.now());
    shop.holidayUntil = until;
    shop.holidayMessage = until ? message || null : shop.holidayMessage;
    // A new holiday (not just a changed date) starts a new round of
    // auto-replies.
    if (until && !wasAway) shop.holidayStartedAt = new Date();
    if (!until) shop.holidayStartedAt = null;
    const saved = await shopRepo.save(shop);
    return res.json({ message: until ? "Holiday mode is on" : "Welcome back — holiday mode is off", shop: ownerShopView(saved) });
  } catch (error) {
    console.error("updateMyHoliday failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/** PUT /shops/mine/stock-alerts { lowStockThreshold } — 0 turns alerts off. */
export const updateMyStockAlerts = async (req: Request, res: Response) => {
  try {
    const shop = await myShop(req.user!.id);
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    shop.lowStockThreshold = (req.body as { lowStockThreshold: number }).lowStockThreshold;
    return res.json({ shop: ownerShopView(await shopRepo.save(shop)) });
  } catch (error) {
    console.error("updateMyStockAlerts failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── Calendar feed ──────────────────────────────────────────────────────────

function apiOrigin(req: Request) {
  // Behind Render's proxy (trust proxy is set), req.protocol is the public one.
  return `${req.protocol}://${req.get("host")}`;
}

function feedUrl(req: Request, token: string) {
  return `${apiOrigin(req)}/api/calendar/${token}.ics`;
}

async function ensureCalendarToken(shopId: string, rotate = false) {
  const current = await shopRepo.findOne({ where: { id: shopId }, select: { id: true, calendarToken: true } });
  if (current?.calendarToken && !rotate) return current.calendarToken;
  const token = crypto.randomBytes(24).toString("hex");
  await shopRepo.update(shopId, { calendarToken: token });
  return token;
}

/** GET /shops/mine/calendar — the private feed URL (created on first use). */
export const getMyCalendarFeed = async (req: Request, res: Response) => {
  try {
    const shop = await myShop(req.user!.id);
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    return res.json({ url: feedUrl(req, await ensureCalendarToken(shop.id)) });
  } catch (error) {
    console.error("getMyCalendarFeed failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/** POST /shops/mine/calendar/reset — a new URL; the old one stops working. */
export const resetMyCalendarFeed = async (req: Request, res: Response) => {
  try {
    const shop = await myShop(req.user!.id);
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    return res.json({ url: feedUrl(req, await ensureCalendarToken(shop.id, true)) });
  } catch (error) {
    console.error("resetMyCalendarFeed failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/calendar/:token.ics — the artisan's bookings as a calendar
 * subscription (the secret token is the only key, as calendar apps can't
 * sign in). Confirmed appointments, plus paid requests still waiting for a
 * yes (marked tentative), from 30 days back.
 */
export const getCalendarFeed = async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token ?? "");
    if (!/^[0-9a-f]{48}$/.test(token)) return res.status(404).send("Not found");
    const shop = await shopRepo
      .createQueryBuilder("shop")
      .addSelect("shop.calendarToken")
      .where("shop.calendarToken = :token", { token })
      .getOne();
    if (!shop) return res.status(404).send("Not found");

    const rows: {
      id: string;
      scheduledAt: Date;
      endsAt: Date | null;
      status: string;
      seats: number;
      notes: string | null;
      updatedAt: Date;
      service: string | null;
      durationMinutes: number | null;
      client: string | null;
    }[] = await AppDataSource.query(
      `SELECT b.id, b."scheduledAt", b."endsAt", b.status::text AS status, b.seats, b.notes, b."updatedAt",
              s.name AS service, s."durationMinutes", u.name AS client
         FROM bookings b
         LEFT JOIN services s ON s.id = b."serviceId"
         LEFT JOIN users u ON u.id = b."clientId"
        WHERE b."shopId" = $1
          AND b."scheduledAt" > now() - interval '30 days'
          AND (b.status = 'confirmed' OR b.status = 'completed'
               OR (b.status = 'pending' AND b."paymentStatus" IN ('authorized', 'paid')))
        ORDER BY b."scheduledAt"
        LIMIT 2000`,
      [shop.id],
    );
    const site = primaryFrontendUrl();
    const ics = buildCalendar(
      `${shop.shopName} — bookings`,
      rows.map((b) => {
        const start = new Date(b.scheduledAt);
        const end = b.endsAt && new Date(b.endsAt).getTime() - start.getTime() > 60_000
          ? new Date(b.endsAt)
          : new Date(start.getTime() + (b.durationMinutes ?? 60) * 60_000);
        const places = b.seats > 1 ? ` (${b.seats} places)` : "";
        return {
          uid: `booking-${b.id}@artisan-market`,
          start,
          end,
          summary: `${b.service ?? "Booking"} — ${b.client ?? "Client"}${places}${b.status === "pending" ? " (to confirm)" : ""}`,
          description: [b.notes ? `Notes: ${b.notes}` : "", `Manage: ${site}/profile-artisan?tab=bookings`].filter(Boolean).join("\n"),
          url: `${site}/profile-artisan?tab=bookings`,
          status: b.status === "pending" ? ("TENTATIVE" as const) : ("CONFIRMED" as const),
          updated: new Date(b.updatedAt),
        };
      }),
    );
    res.set("Content-Type", "text/calendar; charset=utf-8");
    res.set("Cache-Control", "private, max-age=300");
    return res.send(ics);
  } catch (error) {
    console.error("getCalendarFeed failed:", error);
    return res.status(500).send("Server error");
  }
};

// ── Analytics ──────────────────────────────────────────────────────────────

const PLACED = ["authorized", "paid", "partially_refunded"];

/**
 * GET /shops/mine/analytics?days=30 — product page views, orders and sales
 * per day (UTC), totals with conversion, and the top products.
 */
export const getMyAnalytics = async (req: Request, res: Response) => {
  try {
    const shop = await myShop(req.user!.id);
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const since = `(now() AT TIME ZONE 'UTC')::date - ${days - 1}`;

    const [views, orders, top, bookings] = await Promise.all([
      AppDataSource.query(
        `SELECT pv.day::text AS day, SUM(pv.views)::int AS views
           FROM product_views pv JOIN products p ON p.id = pv."productId"
          WHERE p."shopId" = $1 AND pv.day >= ${since}
          GROUP BY pv.day`,
        [shop.id],
      ) as Promise<{ day: string; views: number }[]>,
      AppDataSource.query(
        `SELECT (o."createdAt" AT TIME ZONE 'UTC')::date::text AS day,
                COUNT(DISTINCT COALESCE(o."checkoutGroupId", o.id::text))::int AS orders,
                SUM(ROUND(o."totalAmount" * 100))::bigint AS cents
           FROM orders o
          WHERE o."shopId" = $1 AND o."paymentStatus"::text = ANY($2)
            AND (o."createdAt" AT TIME ZONE 'UTC')::date >= ${since}
          GROUP BY 1`,
        [shop.id, PLACED],
      ) as Promise<{ day: string; orders: number; cents: string }[]>,
      AppDataSource.query(
        `SELECT p.id, p.title, p."imageUrl",
                COALESCE(v.views, 0)::int AS views,
                COALESCE(o.orders, 0)::int AS orders,
                COALESCE(o.units, 0)::int AS units,
                COALESCE(o.cents, 0)::bigint AS cents
           FROM products p
           LEFT JOIN (SELECT "productId", SUM(views) AS views FROM product_views
                       WHERE day >= ${since} GROUP BY "productId") v ON v."productId" = p.id
           LEFT JOIN (SELECT "productId", COUNT(*) AS orders, SUM(quantity) AS units,
                             SUM(ROUND("totalAmount" * 100)) AS cents
                        FROM orders
                       WHERE "shopId" = $1 AND "paymentStatus"::text = ANY($2)
                         AND ("createdAt" AT TIME ZONE 'UTC')::date >= ${since}
                       GROUP BY "productId") o ON o."productId" = p.id
          WHERE p."shopId" = $1 AND p."archivedAt" IS NULL
            AND (COALESCE(v.views, 0) > 0 OR COALESCE(o.orders, 0) > 0)
          ORDER BY cents DESC, views DESC, p.title
          LIMIT 10`,
        [shop.id, PLACED],
      ) as Promise<{ id: string; title: string; imageUrl: string | null; views: number; orders: number; units: number; cents: string }[]>,
      AppDataSource.query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(ROUND("totalAmount" * 100)), 0)::bigint AS cents
           FROM bookings
          WHERE "shopId" = $1 AND "paymentStatus"::text = ANY($2)
            AND ("createdAt" AT TIME ZONE 'UTC')::date >= ${since}`,
        [shop.id, PLACED],
      ) as Promise<{ count: number; cents: string }[]>,
    ]);

    // One entry per day, including quiet ones, oldest first.
    const today = new Date();
    const series = Array.from({ length: days }, (_, i) => {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (days - 1 - i)));
      const key = d.toISOString().slice(0, 10);
      const v = views.find((r) => r.day === key);
      const o = orders.find((r) => r.day === key);
      return { date: key, views: v?.views ?? 0, orders: o?.orders ?? 0, revenue: Number(o?.cents ?? 0) / 100 };
    });
    const totalViews = series.reduce((s, d) => s + d.views, 0);
    const totalOrders = series.reduce((s, d) => s + d.orders, 0);
    const revenue = series.reduce((s, d) => s + Math.round(d.revenue * 100), 0) / 100;

    return res.json({
      days,
      series,
      totals: {
        views: totalViews,
        orders: totalOrders,
        revenue,
        // Orders per 100 product page views.
        conversion: totalViews > 0 ? Math.round((totalOrders / totalViews) * 1000) / 10 : null,
        bookings: bookings[0]?.count ?? 0,
        bookingRevenue: Number(bookings[0]?.cents ?? 0) / 100,
      },
      topProducts: top.map((p) => ({
        id: p.id,
        title: p.title,
        imageUrl: p.imageUrl,
        views: p.views,
        orders: p.orders,
        units: p.units,
        revenue: Number(p.cents) / 100,
        conversion: p.views > 0 ? Math.round((p.orders / p.views) * 1000) / 10 : null,
      })),
    });
  } catch (error) {
    console.error("getMyAnalytics failed:", error);
    return res.status(500).json({ message: "Couldn't load your analytics" });
  }
};

// ── Response time ──────────────────────────────────────────────────────────

/**
 * Median minutes the shop takes to answer a client, over the last 90 days:
 * for each client message that starts a turn, the time to the owner's next
 * reply. Null until there are at least 3 answered turns. Automatic replies
 * don't count.
 */
export async function responseTimeMinutes(shopId: string): Promise<number | null> {
  const [row] = await AppDataSource.query(
    `WITH msgs AS (
       SELECT m."conversationId" AS conv, m."createdAt" AS at, (m."senderId" = s."ownerId") AS owner
         FROM messages m
         JOIN conversations c ON c.id = m."conversationId"
         JOIN shops s ON s.id = c."shopId"
        WHERE c."shopId" = $1 AND m."isAutomatic" = false AND m."createdAt" > now() - interval '90 days'
     ),
     turns AS (
       SELECT conv, at, owner, LAG(owner) OVER (PARTITION BY conv ORDER BY at) AS prev_owner FROM msgs
     ),
     answered AS (
       SELECT t.at AS asked,
              (SELECT MIN(r.at) FROM msgs r WHERE r.conv = t.conv AND r.owner AND r.at > t.at) AS replied
         FROM turns t
        WHERE NOT t.owner AND (t.prev_owner IS NULL OR t.prev_owner)
     )
     SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (replied - asked)) / 60) AS median,
            COUNT(*)::int AS n
       FROM answered WHERE replied IS NOT NULL`,
    [shopId],
  );
  if (!row || Number(row.n) < 3 || row.median === null) return null;
  return Math.max(1, Math.round(Number(row.median)));
}
