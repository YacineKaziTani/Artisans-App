// Must be imported before anything from src/: it fixes the environment the
// app reads at import time.
//
// The tests TRUNCATE every table, so they only ever run against a database
// given explicitly in TEST_DATABASE_URL whose name contains "test" — never
// DATABASE_URL, and never anything from backend/.env (which holds real
// Stripe and email keys).

import path from "path";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Run `npm run test:tempdb` (creates and drops a throwaway database), " +
      "or point TEST_DATABASE_URL at an empty database whose name contains 'test'.",
  );
}
const dbName = decodeURIComponent(new URL(testUrl).pathname.replace(/^\//, ""));
if (!/test/i.test(dbName)) {
  throw new Error(
    `Refusing to run: the test database "${dbName}" doesn't have "test" in its name. ` +
      "The tests wipe every table.",
  );
}

// dotenv (loaded by data-source.ts) never overrides variables that are
// already set, and this points it at a file that doesn't exist, so
// backend/.env is never read.
process.env.DOTENV_CONFIG_PATH = path.join(__dirname, "does-not-exist.env");
process.env.DOTENV_CONFIG_QUIET = "true";

Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: testUrl,
  DB_SYNC: "false",
  JWT_SECRET: "test-jwt-secret-not-used-anywhere-else",
  FRONTEND_URL: "http://localhost:5173",
  STRIPE_SECRET_KEY: "sk_test_fake_key_for_tests",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  // Shops can take payments without a real Connect account.
  STRIPE_TEST_BYPASS_CONNECT: "true",
  PLATFORM_COMMISSION_PERCENT: "10",
  CHECKOUT_TTL_MINUTES: "30",
  BOOKING_FREE_CANCELLATION_HOURS: "24",
  CLOUDINARY_CLOUD_NAME: "test",
  CLOUDINARY_API_KEY: "test",
  CLOUDINARY_API_SECRET: "test",
  TRUST_PROXY: "",
});
// No real email provider — sendMail is also stubbed in the helpers.
for (const key of ["RESEND_API_KEY", "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"]) {
  process.env[key] = "";
}
// Respect an explicit DB_SSL (CI's Postgres has no TLS).
process.env.DB_SSL = process.env.DB_SSL ?? "true";
