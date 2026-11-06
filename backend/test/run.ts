// Integration tests: the real Express app and a real Postgres (schema built
// by the migrations), with Stripe and email stubbed out.
//
//   npm test             — needs TEST_DATABASE_URL (CI sets it)
//   npm run test:tempdb  — creates a throwaway database, runs, drops it
import "./env"; // first: fixes the environment before src/ is loaded
import { after, before, describe } from "node:test";
import { AppDataSource } from "../src/data-source";
import { installFakeStripe } from "./helpers";
import { authTests } from "./auth.test";
import { privacyTests } from "./privacy.test";
import { orderTests } from "./orders.test";
import { bookingTests } from "./bookings.test";
import { reviewTests } from "./reviews.test";

describe("Artisans API", () => {
  before(async () => {
    installFakeStripe();
    // migrationsRun: true — this applies every migration to the empty
    // database, so a broken migration fails the run.
    await AppDataSource.initialize();
  });

  after(async () => {
    // Let any background notification finish before the pool closes.
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  });

  authTests();
  privacyTests();
  orderTests();
  bookingTests();
  reviewTests();
});
