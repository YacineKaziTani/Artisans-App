import { sendMail } from "../config/mail";
import { escapeHtml } from "../lib/html";
import { primaryFrontendUrl } from "../lib/urls";

export interface EmailContent {
  subject: string;
  heading: string;
  /** Plain-text paragraphs; escaped before they go into the HTML. */
  paragraphs: string[];
  cta?: { label: string; path: string };
}

function render({ heading, paragraphs, cta }: EmailContent) {
  const button = cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(primaryFrontendUrl() + cta.path)}"
         style="background:#c2532c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">
         ${escapeHtml(cta.label)}</a></p>`
    : "";
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;line-height:1.5">
    <h2 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading)}</h2>
    ${paragraphs.map((p) => `<p style="margin:0 0 12px">${escapeHtml(p)}</p>`).join("\n")}
    ${button}
    <p style="margin-top:32px;font-size:12px;color:#6b7280">Artisan Market</p>
  </div>`;
}

/** Sends one email, never throwing — a mail outage must not fail a request. */
export async function deliver(to: string | null | undefined, content: EmailContent) {
  // Anonymized (deleted) accounts have a placeholder address.
  if (!to || to.endsWith("@deleted.invalid")) return;
  try {
    await sendMail(to, content.subject, render(content));
  } catch (err) {
    console.error(`[notify] couldn't send "${content.subject}" to ${to}:`, err);
  }
}

/**
 * Runs a notification after the response, detached from the request: it
 * looks up whatever it needs itself, and any failure is only logged.
 */
export function notifyInBackground(task: () => Promise<unknown>) {
  const run = new Promise<void>((resolve) => {
    setImmediate(() => {
      task()
        .catch((err) => console.error("[notify] notification failed:", err))
        .finally(resolve);
    });
  });
  pending.add(run);
  void run.finally(() => pending.delete(run));
}

const pending = new Set<Promise<void>>();

/**
 * Resolves once every background notification started so far has finished
 * (including any they start in turn). Used on shutdown, so a deploy doesn't
 * cut off emails mid-send, and by the tests between cases.
 */
export async function notificationsSettled(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (pending.size && Date.now() < deadline) {
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      Promise.allSettled([...pending]),
      new Promise((r) => {
        timer = setTimeout(r, Math.max(0, deadline - Date.now()));
      }),
    ]);
    clearTimeout(timer);
  }
}

const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * Appointment times in emails, in the shop's time zone — where the
 * appointment happens — and labelled with it ("Dec 1, 2026, 3:00 PM
 * (Europe/Paris)"). They used to always be UTC.
 */
export function formatWhen(date: Date | string, timeZone = "UTC") {
  let format = dateTimeFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone });
    dateTimeFormats.set(timeZone, format);
  }
  return `${format.format(new Date(date))} (${timeZone.replace(/_/g, " ")})`;
}

export function formatMoney(amount: number | string) {
  return `$${Number(amount).toFixed(2)}`;
}
