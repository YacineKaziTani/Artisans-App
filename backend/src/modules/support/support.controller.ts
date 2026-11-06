import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { sendMail } from "../../config/mail";
import { escapeHtml } from "../../lib/html";
import { User, UserRole } from "../users/entities/user.entities";

/**
 * Where contact-form messages go: SUPPORT_EMAIL, or every active admin
 * when it isn't set.
 */
async function supportRecipients(): Promise<string[]> {
  const configured = (process.env.SUPPORT_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (configured.length) return configured;
  const admins = await AppDataSource.getRepository(User).find({
    where: { role: UserRole.SUPER_ADMIN, isActive: true },
    select: { email: true },
  });
  return admins.map((a) => a.email);
}

/** POST /support/contact — the help page's contact form. */
export const contactSupport = async (req: Request, res: Response) => {
  try {
    const { name, email, topic, message, website } = req.body as {
      name: string;
      email: string;
      topic: string;
      message: string;
      website?: string;
    };
    // A filled honeypot: say thanks, send nothing.
    if (website) return res.json({ message: "Thanks — we'll get back to you." });

    const recipients = await supportRecipients();
    if (!recipients.length) {
      console.error("contactSupport failed: no SUPPORT_EMAIL and no admin account to receive the message");
      return res.status(503).json({ message: "Support isn't reachable right now — please try again later." });
    }

    const signedIn = req.user ? ` (signed in as ${req.user.email})` : "";
    const html = `<p><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;${escapeHtml(signedIn)} wrote about <strong>${escapeHtml(topic)}</strong>:</p>
      <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
      <p style="color:#6b7280;font-size:12px">Reply to this email to answer them directly.</p>`;

    for (const to of recipients) {
      await sendMail(to, `[Contact] ${topic}: ${name}`, html, email);
    }
    return res.json({ message: "Thanks — we'll get back to you by email." });
  } catch (error) {
    console.error("contactSupport failed:", error);
    return res.status(502).json({ message: "Your message couldn't be sent. Please try again in a moment." });
  }
};
