// Must be first: error monitoring hooks into http/express as they load.
import { flushErrorMonitoring } from "./instrument";
import "reflect-metadata";
import { createServer } from "http";
import { AppDataSource } from "./data-source";
import { createApp } from "./app";
import { closeSocketServer, initSocketServer } from "./realtime/socket";
import { startCheckoutExpiryJob } from "./jobs/expire-checkouts";
import { mailStatus } from "./config/mail";
import { emailVerificationRequired } from "./config/email-verification";
import { notificationsSettled } from "./notifications/deliver";

// Render sends SIGTERM and waits ~30s before killing the process.
const SHUTDOWN_TIMEOUT_MS = 20_000;

async function bootstrap() {
  await AppDataSource.initialize();
  console.log("Database connected");

  const app = createApp();
  const httpServer = createServer(app);
  initSocketServer(httpServer);

  const port = Number(process.env.PORT ?? 3000);
  httpServer.listen(port, () =>
    console.log(`Listening on http://localhost:${port}`),
  );

  const stopExpiryJob = startCheckoutExpiryJob();
  warnIfEmailCantReachUsers();

  // Graceful shutdown: on a deploy or restart, finish in-flight requests
  // (a checkout mid-transaction, a webhook being processed) instead of
  // dropping them, then release the database connections.
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received — shutting down`);

    const force = setTimeout(() => {
      console.error("Shutdown took too long — forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    force.unref();

    try {
      stopExpiryJob();
      await closeSocketServer(); // also closes httpServer
      await notificationsSettled(); // emails already under way
      if (AppDataSource.isInitialized) await AppDataSource.destroy();
      console.log("Shutdown complete");
      await flushErrorMonitoring();
      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err);
      await flushErrorMonitoring();
      process.exit(1);
    }
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

/**
 * Password resets, order/booking notifications and sign-up confirmation
 * all depend on email — say so loudly at boot if it can't reach real
 * users. (Logged as an error, so error monitoring alerts on it too.)
 */
function warnIfEmailCantReachUsers() {
  const { problem } = mailStatus();
  if (!problem || process.env.NODE_ENV !== "production") return;
  console.error(
    `[mail] Emails won't reach your users: ${problem}` +
      (emailVerificationRequired
        ? " New accounts can't confirm their email, so they can't buy, book or message until this is fixed" +
          " (or set REQUIRE_EMAIL_VERIFICATION=false meanwhile)."
        : ""),
  );
}

// Last-resort net: Node exits on an unhandled rejection by default, which
// turns any missed `await` error (in a socket handler, a timer, a
// fire-and-forget call) into a full outage. Log it and keep serving.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

bootstrap().catch(async (err) => {
  console.error("Startup failed:", err);
  // A failed boot (e.g. a migration error) is exactly what needs alerting.
  await flushErrorMonitoring();
  process.exit(1);
});
