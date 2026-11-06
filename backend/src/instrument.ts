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

/** Sends anything still queued (call before the process exits). */
export async function flushErrorMonitoring(timeoutMs = 2000) {
  if (errorMonitoringEnabled) await Sentry.close(timeoutMs);
}
