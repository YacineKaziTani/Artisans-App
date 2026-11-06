import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";

const CAPTURED = ["paid", "partially_refunded"];

/** Sales, commission and sign-ups for one window [from, to). */
async function windowMetrics(from: Date, to: Date, percent: number) {
  const [sales] = await AppDataSource.query(
    `SELECT COUNT(*)::int AS count,
            COALESCE(SUM(ROUND(amount * 100)), 0)::bigint AS cents,
            COALESCE(SUM(ROUND(ROUND(amount * 100) * $4 / 100.0)), 0)::bigint AS "commissionCents"
       FROM (
         SELECT "totalAmount" AS amount FROM orders
          WHERE "paymentStatus"::text = ANY($3) AND "createdAt" >= $1 AND "createdAt" < $2
         UNION ALL
         SELECT "totalAmount" FROM bookings
          WHERE "paymentStatus"::text = ANY($3) AND "createdAt" >= $1 AND "createdAt" < $2
       ) t`,
    [from, to, CAPTURED, percent],
  );
  const users: { role: string; count: number }[] = await AppDataSource.query(
    `SELECT role::text AS role, COUNT(*)::int AS count FROM users
      WHERE "createdAt" >= $1 AND "createdAt" < $2 AND "deletedAt" IS NULL
      GROUP BY role`,
    [from, to],
  );
  const signups = Object.fromEntries(users.map((u) => [u.role, u.count]));
  return {
    sales: sales.count as number,
    volume: Number(sales.cents) / 100,
    commission: Number(sales.commissionCents) / 100,
    newClients: signups.client ?? 0,
    newArtisans: signups.artisan ?? 0,
  };
}

/**
 * GET /metrics/admin?days=30 — how the marketplace is doing: the last N
 * days next to the N before, plus shops by status. Volume is what clients
 * paid (captured payments); commission is the platform's share of it.
 */
export const getAdminMetrics = async (req: Request, res: Response) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const now = new Date();
    const start = new Date(now.getTime() - days * 864e5);
    const previousStart = new Date(start.getTime() - days * 864e5);
    const percent = Number(process.env.PLATFORM_COMMISSION_PERCENT ?? 10);

    const [current, previous, shops] = await Promise.all([
      windowMetrics(start, now, percent),
      windowMetrics(previousStart, start, percent),
      AppDataSource.query(`SELECT status::text AS status, COUNT(*)::int AS count FROM shops GROUP BY status`),
    ]);
    return res.json({
      days,
      commissionPercent: percent,
      current,
      previous,
      shops: Object.fromEntries((shops as { status: string; count: number }[]).map((s) => [s.status, s.count])),
    });
  } catch (error) {
    console.error("getAdminMetrics failed:", error);
    return res.status(500).json({ message: "Couldn't load metrics" });
  }
};
