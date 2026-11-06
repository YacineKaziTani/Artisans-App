import crypto from "crypto";
import { Request, Response } from "express";
import { IsNull, Not } from "typeorm";
import { AppDataSource } from "../../data-source";
import { NewsletterSubscriber } from "./newsletter.entities";
import { deliver, notifyInBackground } from "../../notifications/deliver";

const repo = AppDataSource.getRepository(NewsletterSubscriber);
const newToken = () => crypto.randomBytes(32).toString("hex");

/**
 * POST /newsletter/subscribe — sends a confirmation link (double opt-in).
 * Always gives the same answer, so it doesn't reveal who's subscribed.
 */
export const subscribe = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email).toLowerCase();
    let subscriber = await repo.findOne({ where: { email } });
    const alreadyIn = subscriber?.confirmedAt && !subscriber.unsubscribedAt;

    if (!alreadyIn) {
      subscriber = subscriber ?? repo.create({ email });
      subscriber.token = newToken();
      await repo.save(subscriber);
      const token = subscriber.token;
      notifyInBackground(() =>
        deliver(email, {
          subject: "Confirm your Artisan Market newsletter subscription",
          heading: "One click to confirm",
          paragraphs: [
            "You (or someone using your address) asked to get Artisan Market news: new makers, featured work and the occasional offer.",
            "If that wasn't you, ignore this email and you won't hear from us.",
          ],
          cta: { label: "Yes, subscribe me", path: `/newsletter?confirm=${token}` },
        }),
      );
    }
    return res.json({ message: "Check your inbox — click the link we sent to confirm." });
  } catch (error) {
    console.error("subscribe failed:", error);
    return res.status(500).json({ message: "Couldn't subscribe you right now" });
  }
};

/** POST /newsletter/confirm { token } */
export const confirmSubscription = async (req: Request, res: Response) => {
  try {
    const subscriber = await repo.findOne({ where: { token: String(req.body.token) } });
    if (!subscriber) return res.status(400).json({ message: "This link is invalid or out of date." });
    subscriber.confirmedAt = subscriber.confirmedAt ?? new Date();
    subscriber.unsubscribedAt = null;
    await repo.save(subscriber);
    return res.json({ message: "You're subscribed — thanks!" });
  } catch (error) {
    console.error("confirmSubscription failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/** POST /newsletter/unsubscribe { token } — the link in every newsletter. */
export const unsubscribe = async (req: Request, res: Response) => {
  try {
    const subscriber = await repo.findOne({ where: { token: String(req.body.token) } });
    if (!subscriber) return res.status(400).json({ message: "This link is invalid or out of date." });
    subscriber.unsubscribedAt = subscriber.unsubscribedAt ?? new Date();
    await repo.save(subscriber);
    return res.json({ message: "You've been unsubscribed. Sorry to see you go." });
  } catch (error) {
    console.error("unsubscribe failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const activeWhere = { confirmedAt: Not(IsNull()), unsubscribedAt: IsNull() };

/** GET /newsletter/admin/stats */
export const getNewsletterStats = async (_req: Request, res: Response) => {
  try {
    const [subscribed, pending] = await Promise.all([
      repo.count({ where: activeWhere }),
      repo.count({ where: { confirmedAt: IsNull() } }),
    ]);
    return res.json({ subscribed, pending });
  } catch (error) {
    console.error("getNewsletterStats failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /newsletter/admin/export — confirmed subscribers as CSV, with each
 * one's unsubscribe link (paste it into the email tool's footer field).
 */
export const exportSubscribers = async (_req: Request, res: Response) => {
  try {
    const rows = await repo.find({ where: activeWhere, order: { confirmedAt: "ASC" } });
    const site = (process.env.FRONTEND_URL ?? "http://localhost:5173").split(",")[0].trim().replace(/\/+$/, "");
    const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [
      "email,confirmed_at,unsubscribe_url",
      ...rows.map((r) =>
        [quote(r.email), r.confirmedAt!.toISOString(), quote(`${site}/newsletter?unsubscribe=${r.token}`)].join(","),
      ),
    ].join("\n");
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", 'attachment; filename="newsletter-subscribers.csv"');
    return res.send(csv + "\n");
  } catch (error) {
    console.error("exportSubscribers failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
