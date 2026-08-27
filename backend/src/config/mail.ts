import nodemailer from "nodemailer";

const { RESEND_API_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } =
  process.env;

const MAIL_FROM =
  process.env.MAIL_FROM ?? process.env.SMTP_FROM ?? "onboarding@resend.dev";

const smtpConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASSWORD);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT ? Number(SMTP_PORT) : 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    })
  : null;

async function sendViaResend(to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: MAIL_FROM, to, subject, html }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend rejected the email (${response.status}): ${body}`);
  }
}

export async function sendMail(to: string, subject: string, html: string) {
  if (RESEND_API_KEY) {
    await sendViaResend(to, subject, html);
    return;
  }

  if (transporter) {
    await transporter.sendMail({ from: MAIL_FROM, to, subject, html });
    return;
  }

  console.warn(
    [
      "",
      "──────────────────────────────────────────────────────────────",
      " [mail] No email provider configured — nothing was sent.",
      " Set RESEND_API_KEY in backend/.env to deliver for real.",
      ` To:      ${to}`,
      ` Subject: ${subject}`,
      "",
      html,
      "──────────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}
