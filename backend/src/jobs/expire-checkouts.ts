import { expireStaleOrders } from "../modules/orders/order.controller";
import { expireStaleBookings } from "../modules/booking/booking.controller";
import { CHECKOUT_TTL_MINUTES } from "../config/checkout";

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
