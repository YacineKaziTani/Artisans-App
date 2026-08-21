import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASSWORD,
  SMTP_FROM = "no-reply@artisans-app.local",
} = process.env;

const isConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASSWORD);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT ? Number(SMTP_PORT) : 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    })
  : null;

export async function sendMail(to: string, subject: string, html: string) {
  if (!transporter) {
    // No SMTP configured (e.g. local dev) — log instead of failing outright,
    // so the reset-password flow is still exercisable without real email.
    console.warn(
      `[mail] SMTP not configured — would have sent to ${to}: ${subject}\n${html}`,
    );
    return;
  }

  await transporter.sendMail({ from: SMTP_FROM, to, subject, html });
}
