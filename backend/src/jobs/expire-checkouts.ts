import { expireStaleOrders } from "../modules/orders/order.controller";
import {
  autoCompleteBookings,
  expireStaleBookings,
  reconcileStaleHolds,
  sendBookingHoldReminders,
  sendBookingReminders,
} from "../modules/booking/booking.controller";
import { sendOrderHoldReminders } from "../modules/orders/order.controller";
import { notifyUnreadMessages } from "../notifications";
import { refreshAllStripeStatuses } from "../modules/shop/shop.controller";
import { CHECKOUT_TTL_MINUTES } from "../config/checkout";
import { AppDataSource } from "../data-source";

// Read notifications are kept 90 days, unread ones a year.
async function pruneNotifications() {
  const result = await AppDataSource.query(
    `DELETE FROM notifications
      WHERE ("readAt" IS NOT NULL AND "createdAt" < now() - interval '90 days')
         OR "createdAt" < now() - interval '365 days'`,
  );
  return Array.isArray(result) ? (result[1] ?? 0) : 0;
}

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const FIRST_SWEEP_DELAY_MS = 30 * 1000;

let running = false;

/**
 * Releases checkouts the client never paid for: the stock reserved by
 * unpaid orders and the time slots held by unpaid bookings. Each candidate
 * is checked against Stripe first, so a payment whose webhook is merely
 * late is kept rather than discarded.
 *
 * Safe to run on several instances at once — every discard is a
 * conditional delete, so only one sweep can act on a given row.
 */
export async function sweepUnpaidCheckouts() {
  if (running) return; // a slow sweep shouldn't overlap the next tick
  running = true;
  try {
    const orders = await expireStaleOrders();
    const bookings = await expireStaleBookings();
    await runTasks();
    if (orders || bookings) {
      console.log(
        `[checkout-expiry] released ${orders} unpaid order(s) and ${bookings} unpaid booking(s) older than ${CHECKOUT_TTL_MINUTES} min`,
      );
    }
  } catch (err) {
    console.error("[checkout-expiry] sweep failed:", err);
  } finally {
    running = false;
  }
}

const CONNECT_REFRESH_MS = 6 * 60 * 60 * 1000;
let lastConnectRefresh = 0;
const RECONCILE_MS = 60 * 60 * 1000;
let lastReconcile = 0;

/**
 * The other periodic work, each step on its own so one failing (Stripe
 * down, say) doesn't stop the rest.
 */
async function runTasks() {
  const tasks: [string, () => Promise<number>][] = [
    ["old notifications removed", pruneNotifications],
    ["unread-message alerts sent", () => notifyUnreadMessages()],
    ["booking reminders sent", sendBookingReminders],
    ["bookings auto-completed", autoCompleteBookings],
    ["order hold reminders sent", sendOrderHoldReminders],
    ["booking hold reminders sent", sendBookingHoldReminders],
  ];
  if (Date.now() - lastReconcile > RECONCILE_MS) {
    lastReconcile = Date.now();
    tasks.push(["stale card holds reconciled with Stripe", () => reconcileStaleHolds()]);
  }
  if (Date.now() - lastConnectRefresh > CONNECT_REFRESH_MS) {
    lastConnectRefresh = Date.now();
    tasks.push(["shops' Stripe status changed", () => refreshAllStripeStatuses()]);
  }
  for (const [label, task] of tasks) {
    try {
      const count = await task();
      if (count) console.log(`[sweep] ${count} ${label}`);
    } catch (err) {
      console.error(`[sweep] "${label}" failed:`, err);
    }
  }
}

export function startCheckoutExpiryJob() {
  const first = setTimeout(sweepUnpaidCheckouts, FIRST_SWEEP_DELAY_MS);
  const interval = setInterval(sweepUnpaidCheckouts, SWEEP_INTERVAL_MS);
  // Don't keep the process alive just for the sweep.
  first.unref();
  interval.unref();
  return () => {
    clearTimeout(first);
    clearInterval(interval);
  };
}
