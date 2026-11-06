import { Request, Response } from "express";
import { mailStatus, sendMail } from "../../../config/mail";
import { escapeHtml } from "../../../lib/html";

/** Admin dashboard: which email provider is in use and whether it reaches real users. */
export const getEmailStatus = (_req: Request, res: Response) => {
  res.json(mailStatus());
};

/**
 * Sends a test email to the signed-in admin and reports what the provider
 * said. Unlike notifications (which never fail a request), this surfaces
 * the provider's error so delivery can be checked on the live site.
 */
export const sendTestEmail = async (req: Request, res: Response) => {
  const status = mailStatus();
  const to = req.user!.email;
  try {
    await sendMail(
      to,
      "Artisan Market — test email",
      `<p>Hi ${escapeHtml(req.user!.name)},</p>
       <p>This is a test from the admin dashboard. If you're reading it, email delivery works.</p>
       <p style="color:#6b7280;font-size:12px">Sent with ${escapeHtml(status.provider)} from ${escapeHtml(status.from)}</p>`,
    );
    return res.json({ ...status, sentTo: to, sent: status.provider !== "none" });
  } catch (error) {
    console.error("sendTestEmail failed:", error);
    return res.status(502).json({
      ...status,
      sentTo: to,
      sent: false,
      message: error instanceof Error ? error.message : "The email provider rejected the message",
    });
  }
};
