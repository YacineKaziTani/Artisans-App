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

async function sendViaResend(to: string, subject: string, html: string, replyTo?: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: MAIL_FROM, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend rejected the email (${response.status}): ${body}`);
  }
}

export interface MailStatus {
  provider: "resend" | "smtp" | "none";
  from: string;
  /** What's stopping mail from reaching real users, if anything. */
  problem: string | null;
}

/** Which provider is in use, and whether real users will get the mail. */
export function mailStatus(): MailStatus {
  const provider = RESEND_API_KEY ? "resend" : smtpConfigured ? "smtp" : "none";
  let problem: string | null = null;
  if (provider === "none") {
    problem =
      "No email provider is configured (RESEND_API_KEY or SMTP_*), so emails are only printed to the server log.";
  } else if (provider === "resend" && /@resend\.dev$/i.test(MAIL_FROM)) {
    problem =
      "MAIL_FROM is Resend's test address, which only delivers to the inbox that owns the Resend account. Verify your domain in Resend and set MAIL_FROM to an address on it.";
  }
  return { provider, from: MAIL_FROM, problem };
}

/** `replyTo`: where a reply goes (e.g. the visitor who used the contact form). */
export async function sendMail(to: string, subject: string, html: string, replyTo?: string) {
  if (RESEND_API_KEY) {
    await sendViaResend(to, subject, html, replyTo);
    return;
  }

  if (transporter) {
    await transporter.sendMail({ from: MAIL_FROM, to, subject, html, replyTo });
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
