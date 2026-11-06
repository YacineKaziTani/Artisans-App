// Privacy-friendly, cookieless analytics — Plausible or Umami — off unless
// configured. Page views (including in-app navigation) are counted by the
// script itself; track() adds the business events below.

type Props = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Props }) => void;
    umami?: { track: (event: string, data?: Props) => void };
  }
}

function addScript(src: string, attrs: Record<string, string>) {
  const script = document.createElement("script");
  script.defer = true;
  script.src = src;
  for (const [key, value] of Object.entries(attrs)) script.setAttribute(key, value);
  document.head.appendChild(script);
}

export function initAnalytics() {
  const env = import.meta.env;
  if (env.VITE_PLAUSIBLE_DOMAIN) {
    addScript(env.VITE_PLAUSIBLE_SRC || "https://plausible.io/js/script.js", {
      "data-domain": env.VITE_PLAUSIBLE_DOMAIN,
    });
  } else if (env.VITE_UMAMI_WEBSITE_ID) {
    addScript(env.VITE_UMAMI_SRC || "https://cloud.umami.is/script.js", {
      "data-website-id": env.VITE_UMAMI_WEBSITE_ID,
    });
  }
}

/** The events worth counting — named the same in both tools. */
export type AnalyticsEvent =
  | "Sign up"
  | "Checkout started"
  | "Payment authorized"
  | "Shop created"
  | "Newsletter signup";

/** Records a business event; a no-op when analytics is off or blocked. */
export function track(event: AnalyticsEvent, props?: Props) {
  try {
    if (window.plausible) window.plausible(event, props ? { props } : undefined);
    else window.umami?.track(event, props);
  } catch {
    // Analytics must never break the app.
  }
}
