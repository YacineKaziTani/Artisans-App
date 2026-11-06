// Error monitoring (Sentry). Off unless VITE_SENTRY_DSN is set, and loaded
// on demand — visitors don't download the SDK when it's off.

type SentryModule = typeof import("@sentry/react");

let sentry: SentryModule | undefined;

/** Drops ?query and #hash: our links carry one-time tokens and emails. */
function stripQuery(url: string) {
  return url.replace(/[?#].*$/, "");
}

export function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  void import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // Errors and stack traces only — no cookies, headers, bodies or user
      // details. (The session cookie is httpOnly anyway.)
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        stackFrameVariables: false,
      },
      // Belt and braces for URLs, which carry reset / confirmation tokens.
      beforeBreadcrumb(breadcrumb) {
        const data = breadcrumb.data;
        if (data) {
          for (const key of ["url", "from", "to"] as const) {
            if (typeof data[key] === "string") data[key] = stripQuery(data[key]);
          }
        }
        return breadcrumb;
      },
      beforeSend(event) {
        if (event.request?.url) event.request.url = stripQuery(event.request.url);
        delete event.request?.query_string;
        return event;
      },
    });
    sentry = Sentry;
  });
}

/**
 * Errors React caught in a render (error boundaries, React Router's error
 * page) or couldn't recover from. Uncaught errors and promise rejections
 * outside React are picked up by Sentry on its own once loaded.
 */
export function reportReactError(error: unknown, componentStack?: string) {
  console.error(error);
  sentry?.captureReactException(error, { componentStack: componentStack ?? "" });
}
