// Error monitoring (Sentry). Imported first by index.ts so Sentry can hook
// into http/express before they load. Does nothing unless SENTRY_DSN is set.
import "dotenv/config";
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    // Errors and their stack traces only. Sentry's defaults would also
    // send cookies (the session), headers, request bodies (passwords on
    // login/sign-up), user details, query values and local variables.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
    // Some log lines name an address ("couldn't send … to ada@example.com").
    beforeSend: (event) => scrubEmails(event),
    beforeBreadcrumb: (breadcrumb) => scrubEmails(breadcrumb),
    integrations: [
      // Every failure path in the API already logs with console.error
      // ("<handler> failed:", error) — report each of those, with the
      // error's stack trace, rather than threading Sentry through 70+
      // catch blocks.
      Sentry.captureConsoleIntegration({ levels: ["error"] }),
    ],
  });
}

export const errorMonitoringEnabled = Boolean(dsn);

const EMAIL = /[^\s@"'<>()]+@[^\s@"'<>()]+\.[a-z]{2,}/gi;

/** Replaces email addresses in every string inside an event, recursively. */
export function scrubEmails<T>(value: T, depth = 0): T {
  if (typeof value === "string") return value.replace(EMAIL, "[email]") as T;
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => scrubEmails(v, depth + 1)) as T;
  for (const key of Object.keys(value as object)) {
    (value as Record<string, unknown>)[key] = scrubEmails((value as Record<string, unknown>)[key], depth + 1);
  }
  return value;
}

/** Sends anything still queued (call before the process exits). */
export async function flushErrorMonitoring(timeoutMs = 2000) {
  if (errorMonitoringEnabled) await Sentry.close(timeoutMs);
}
