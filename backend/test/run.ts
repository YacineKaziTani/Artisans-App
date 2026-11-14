// Integration tests: the real Express app and a real Postgres (schema built
// by the migrations), with Stripe and email stubbed out.
//
//   npm test             — needs TEST_DATABASE_URL (CI sets it)
//   npm run test:tempdb  — creates a throwaway database, runs, drops it
import "./env"; // first: fixes the environment before src/ is loaded
import { after, before, describe } from "node:test";
import { AppDataSource } from "../src/data-source";
import { installFakeCloudinary, installFakeStripe } from "./helpers";
import { notificationsSettled } from "../src/notifications/deliver";
import { adminBootstrapTests, authTests } from "./auth.test";
import { privacyTests } from "./privacy.test";
import { orderTests } from "./orders.test";
import { bookingTests } from "./bookings.test";
import { reviewTests } from "./reviews.test";
import { securityTests } from "./security.test";
import { verificationTests } from "./verification.test";
import { scheduleTests } from "./schedule.test";
import { shopSettingsTests } from "./shop-settings.test";
import { searchTests } from "./search.test";
import { reviewExtrasTests } from "./review-extras.test";
import { notificationTests } from "./notifications.test";
import { supportTests } from "./support.test";
import { growthTests, metricsTests } from "./growth.test";
import { fixesTests } from "./fixes.test";
import { highValueTests } from "./high-value.test";
import { accountTests } from "./account.test";
import { holdTests } from "./holds.test";
import { storefrontTests } from "./storefront.test";
import { marketplaceGrowthTests } from "./marketplace-growth.test";

describe("Artisans API", () => {
  before(async () => {
    installFakeStripe();
    installFakeCloudinary();
    // migrationsRun: true — this applies every migration to the empty
    // database, so a broken migration fails the run.
    await AppDataSource.initialize();
  });

  after(async () => {
    // Let any background notification finish before the pool closes.
    await notificationsSettled();
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  });

  authTests();
  adminBootstrapTests();
  privacyTests();
  orderTests();
  bookingTests();
  reviewTests();
  securityTests();
  verificationTests();
  scheduleTests();
  shopSettingsTests();
  searchTests();
  reviewExtrasTests();
  notificationTests();
  supportTests();
  growthTests();
  metricsTests();
  fixesTests();
  highValueTests();
  accountTests();
  holdTests();
  storefrontTests();
  marketplaceGrowthTests();
});
