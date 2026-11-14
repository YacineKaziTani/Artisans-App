import { Request, Response } from "express";
import Stripe from "stripe";
import { EntityManager, In, IsNull, Not } from "typeorm";
import { AppDataSource } from "../../data-source";
import { Booking, BookingStatus, PaymentStatus } from "./booking.entities";
import { Shop, ShopStatus } from "../shop/shop.entities";
import { Service } from "../services/service.entities";
import { User } from "../users/entities/user.entities";
import {
  isUuid,
  pageResult,
  parsePagination,
  queryString,
} from "../../middleware/validate.middleware";
import { fromCents, toCents } from "../../lib/money";
import {
  stripe,
  shopCanAcceptPayments,
  connectChargeParams,
  connectRefundParams,
  closeUnpaidIntent,
  cancelIntentQuietly,
} from "../../config/stripe";
import {
  createdBeforeCheckoutTtl,
  withinCheckoutTtlSql,
} from "../../config/checkout";
import {
  handleOrderIntentAuthorized,
  handleOrderIntentCaptured,
  handleOrderIntentFailed,
  handleOrderIntentCanceled,
} from "../orders/order.controller";
import { ProcessedWebhookEvent } from "../webhook-events/webhook-event.entities";
import {
  notifyBookingCompleted,
  notifyBookingHoldExpired,
  notifyBookingHoldExpiring,
  notifyBookingReminder,
} from "../../notifications";
import {
  dayWindow,
  hasOpeningHours,
  slotsForDate,
  withinOpeningHours,
  type Interval,
} from "../../lib/schedule";
import { notifyInBackground } from "../../notifications/deliver";
import {
  notifyBookingAuthorized,
  notifyBookingCancelledByClient,
  notifyBookingUpdatedByShop,
} from "../../notifications";

const processedEventRepo = AppDataSource.getRepository(ProcessedWebhookEvent);

const bookingRepo = AppDataSource.getRepository(Booking);
const shopRepo = AppDataSource.getRepository(Shop);
const serviceRepo = AppDataSource.getRepository(Service);

// Nothing has been authorized on the card yet.
const UNPAID_STATES = [PaymentStatus.UNPAID, PaymentStatus.FAILED];
// The card is on hold or already charged — safe to confirm.
const CONFIRMABLE_STATES = [PaymentStatus.AUTHORIZED, PaymentStatus.PAID];
// Bookings that occupy their time slot.
const LIVE_STATUSES = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

const CONCURRENT_UPDATE = {
  message: "This booking was just updated — refresh and try again",
};

// Request bodies are validated by the zod schemas in booking.schemas.ts.

/**
 * Clients may cancel a *confirmed* (paid) booking for a full refund only up
 * to this many hours before the appointment. Before the artisan confirms,
 * nothing has been charged, so a pending booking can always be cancelled.
 */
const FREE_CANCELLATION_HOURS = Math.max(
  0,
  Number(process.env.BOOKING_FREE_CANCELLATION_HOURS ?? 24) || 0,
);
const MAX_BOOKING_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;
// A service without an appointment length occupies a one-minute slot, so
// it only clashes with a booking at the same start time.
const DEFAULT_SLOT_MINUTES = 1;

/** Why the client can't cancel this booking themselves, or null if they can. */
function clientCancellationBlock(booking: Booking): string | null {
  if (booking.status === BookingStatus.PENDING) return null;
  const msUntil = new Date(booking.scheduledAt).getTime() - Date.now();
  if (msUntil <= 0) {
    return "This appointment time has already passed — open a dispute if something went wrong.";
  }
  if (msUntil < FREE_CANCELLATION_HOURS * 60 * 60 * 1000) {
    return `Confirmed bookings can be cancelled up to ${FREE_CANCELLATION_HOURS} hours before the appointment. Message the artisan, or open a dispute if something went wrong.`;
  }
  return null;
}

/**
 * Deletes a booking that was never paid for, freeing its time slot. The
 * delete only matches a still-pending, never-authorized row, so concurrent
 * cleanup paths (expiry sweep, client backing out, the canceled webhook)
 * can't trip over each other. Stripe keeps the cancelled PaymentIntent, with
 * the booking id in its metadata, as the record.
 */
async function discardUnpaidBooking(id: string) {
  const result = await bookingRepo.delete({
    id,
    status: BookingStatus.PENDING,
    paymentStatus: In(UNPAID_STATES),
  });
  return (result.affected ?? 0) > 0;
}

export const createBooking = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { serviceId, scheduledAt, notes } = req.body as {
      serviceId: string;
      scheduledAt: Date;
      notes?: string;
    };
    const seats = (req.body as { seats?: number }).seats ?? 1;

    const service = await serviceRepo.findOne({
      where: { id: serviceId, archivedAt: IsNull() },
      relations: ["shop", "shop.owner"],
    });
    if (!service || !service.isAvailable) {
      return res.status(404).json({ message: "Service not found" });
    }
    if (service.shop.owner?.id === userId) {
      return res
        .status(400)
        .json({ message: "You can't book a service from your own shop" });
    }
    if (service.shop.status !== ShopStatus.ACTIVE) {
      return res
        .status(400)
        .json({ message: "This shop isn't currently accepting bookings." });
    }
    if (!shopCanAcceptPayments(service.shop)) {
      return res.status(400).json({
        message:
          "This shop hasn't finished setting up payouts yet and can't accept bookings.",
      });
    }

    const capacity = Math.max(1, service.capacity ?? 1);
    if (seats > capacity) {
      return res.status(400).json({
        message: capacity === 1
          ? "This is a private appointment — book one place."
          : `Each session has ${capacity} places — book ${capacity} or fewer.`,
      });
    }

    const now = Date.now();
    if (scheduledAt.getTime() <= now) {
      return res
        .status(400)
        .json({ message: "Choose a date and time in the future" });
    }
    // Each shop's own rules: minimum notice, and how far ahead it takes bookings.
    const { earliest, latest } = bookingWindow(service.shop, now);
    const holidayEnd = service.shop.holidayUntil?.getTime() ?? 0;
    if (holidayEnd > now && scheduledAt.getTime() < holidayEnd) {
      const back = service.shop.holidayUntil!.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        timeZone: service.shop.timezone || "UTC",
      });
      return res.status(400).json({
        message: `${service.shop.shopName} is away until ${back} — please pick a time after that.`,
      });
    }
    if (scheduledAt.getTime() < earliest) {
      const hours = service.shop.bookingMinNoticeHours;
      return res.status(400).json({
        message: `This artisan needs at least ${hours} hour${hours === 1 ? "" : "s"}' notice — please pick a later time.`,
      });
    }
    if (scheduledAt.getTime() > latest) {
      const days = service.shop.bookingMaxDaysAhead ?? 365;
      return res.status(400).json({
        message: `This artisan takes bookings up to ${days} day${days === 1 ? "" : "s"} ahead.`,
      });
    }

    const shopId = service.shop.id;
    const endsAt = new Date(
      scheduledAt.getTime() +
        (service.durationMinutes ?? DEFAULT_SLOT_MINUTES) * 60 * 1000,
    );

    // Shops with opening hours only take appointments inside them (read in
    // the shop's time zone). Shops without fixed hours take requests for
    // any time and confirm or decline each one.
    if (
      hasOpeningHours(service.shop.openingHours) &&
      !withinOpeningHours(service.shop.openingHours, service.shop.timezone, scheduledAt, endsAt)
    ) {
      return res.status(400).json({
        message: "That time is outside this shop's opening hours — please pick one of the available times.",
      });
    }

    const booking = await AppDataSource.transaction(async (manager) => {
      // One booking at a time per shop: without this lock, two requests
      // for the same slot could both pass the overlap check below.
      await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `booking:${shopId}`,
      ]);

      // A slot is taken by any live booking overlapping it — except an
      // unpaid one older than the checkout TTL, which the expiry sweep is
      // about to delete. For a class, other clients in the *same session*
      // (same service, same start) share it until the places run out.
      const overlapping = await liveBookingsBetween(shopId, scheduledAt, endsAt, manager);
      const sameSession = (row: (typeof overlapping)[number]) =>
        capacity > 1 &&
        row.serviceId === service.id &&
        row.start.getTime() === scheduledAt.getTime();
      if (overlapping.some((row) => !sameSession(row))) return { clash: "time" as const };
      const taken = overlapping.reduce((sum, row) => sum + row.seats, 0);
      if (taken + seats > capacity) return { clash: "full" as const, left: Math.max(0, capacity - taken) };

      return manager.save(
        manager.create(Booking, {
          client: { id: userId } as User,
          shop: service.shop,
          service,
          scheduledAt,
          endsAt,
          notes,
          seats,
          totalAmount: fromCents(toCents(service.price) * seats),
          status: BookingStatus.PENDING,
          paymentStatus: PaymentStatus.UNPAID,
        }),
      );
    });
    if ("clash" in booking) {
      return res.status(409).json({
        message:
          booking.clash === "full"
            ? booking.left > 0
              ? `Only ${booking.left} place${booking.left === 1 ? "" : "s"} left in that session.`
              : "That session is full — please pick another time."
            : "That time overlaps another booking at this shop — please pick a different time",
      });
    }

    const amountInCents = toCents(service.price) * seats;
    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        capture_method: "manual",
        metadata: { type: "booking", bookingId: booking.id },
        receipt_email: req.user!.email,
        automatic_payment_methods: { enabled: true },
        ...connectChargeParams(service.shop, amountInCents),
      });
    } catch (err) {
      // Nothing the client could pay — free the slot instead of holding it.
      await discardUnpaidBooking(booking.id);
      throw err;
    }

    await bookingRepo.update(booking.id, { stripePaymentIntentId: intent.id });
    booking.stripePaymentIntentId = intent.id;

    return res.status(201).json({
      booking,
      clientSecret: intent.client_secret,
    });
  } catch (error) {
    console.error("createBooking failed:", error);
    return res.status(500).json({ message: "Error creating booking" });
  }
};

const LIST_PAGE = { defaultLimit: 20, maxLimit: 100 };

/** Optional ?status= filter, ignored if it isn't a real status. */
function statusFilter(value: unknown) {
  const status = queryString(value) as BookingStatus | undefined;
  return status && Object.values(BookingStatus).includes(status)
    ? status
    : undefined;
}

export const getMyBookings = async (req: Request, res: Response) => {
  try {
    const { page, take, skip } = parsePagination(req.query, LIST_PAGE);
    const status = statusFilter(req.query.status);
    const [bookings, total] = await bookingRepo.findAndCount({
      where: { client: { id: req.user!.id }, ...(status ? { status } : {}) },
      relations: ["shop", "service"],
      order: { createdAt: "DESC", id: "ASC" },
      skip,
      take,
    });
    // Tell the client up front whether they can still cancel each booking
    // themselves (see FREE_CANCELLATION_HOURS), so the UI can explain why not.
    const withPolicy = bookings.map((booking) => {
      const cancellable = LIVE_STATUSES.includes(booking.status);
      const blockedReason = cancellable ? clientCancellationBlock(booking) : null;
      return Object.assign(booking, {
        canCancel: cancellable && !blockedReason,
        cancelBlockedReason: blockedReason,
      });
    });
    return res.json(pageResult(withPolicy, total, page, take));
  } catch (error) {
    console.error("getMyBookings failed:", error);
    return res.status(500).json({ message: "Error fetching bookings" });
  }
};

export const getShopBookings = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({
      where: { owner: { id: req.user!.id } },
    });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const { page, take, skip } = parsePagination(req.query, LIST_PAGE);
    const status = statusFilter(req.query.status);

    // A booking the client never paid for isn't something the artisan can
    // act on (its slot is released after the checkout TTL), so it's left out.
    const [bookings, total] = await bookingRepo
      .createQueryBuilder("b")
      .leftJoinAndSelect("b.service", "service")
      .leftJoinAndSelect("b.client", "client")
      .where("b.shopId = :shopId", { shopId: shop.id })
      .andWhere(
        "NOT (b.status = :pending AND b.paymentStatus IN (:...unpaid))",
        { pending: BookingStatus.PENDING, unpaid: UNPAID_STATES },
      )
      .andWhere(status ? "b.status = :status" : "TRUE", { status })
      // Upcoming appointments first (soonest at the top), then past ones
      // (most recent first).
      .orderBy(`CASE WHEN b."scheduledAt" >= now() THEN 0 ELSE 1 END`, "ASC")
      .addOrderBy(`CASE WHEN b."scheduledAt" >= now() THEN b."scheduledAt" END`, "ASC")
      .addOrderBy("b.scheduledAt", "DESC")
      .addOrderBy("b.id", "ASC")
      // Only many-to-one joins, so rows can't multiply: plain OFFSET/LIMIT
      // is correct here (and skip/take's subquery can't order by expressions).
      .offset(skip)
      .limit(take)
      .getManyAndCount();
    return res.json(pageResult(bookings, total, page, take));
  } catch (error) {
    console.error("getShopBookings failed:", error);
    return res.status(500).json({ message: "Error fetching bookings" });
  }
};

/**
 * Cancels a pending/confirmed booking: releases the card hold, refunds a
 * captured payment, or closes an unpaid checkout.
 *
 * The row is claimed as CANCELLED *before* Stripe is called (and put back if
 * Stripe fails), so the payment_intent.canceled webhook our own cancel
 * triggers finds it already cancelled rather than mistaking it for an
 * abandoned checkout. Returns false if it was no longer pending/confirmed.
 */
async function cancelBooking(booking: Booking) {
  const previous = booking.status;
  const claimed = await bookingRepo.update(
    { id: booking.id, status: In(LIVE_STATUSES) },
    { status: BookingStatus.CANCELLED },
  );
  if (!claimed.affected) return false;

  const intentId = booking.stripePaymentIntentId;
  let paymentStatus = booking.paymentStatus;
  try {
    if (booking.paymentStatus === PaymentStatus.AUTHORIZED && intentId) {
      await stripe.paymentIntents.cancel(intentId);
      paymentStatus = PaymentStatus.UNPAID; // hold released, never charged
    } else if (booking.paymentStatus === PaymentStatus.PAID && intentId) {
      await stripe.refunds.create({
        payment_intent: intentId,
        ...connectRefundParams(),
      });
      paymentStatus = PaymentStatus.REFUNDED;
    } else if (UNPAID_STATES.includes(booking.paymentStatus)) {
      await cancelIntentQuietly(intentId);
    }
  } catch (err) {
    await bookingRepo.update(
      { id: booking.id, status: BookingStatus.CANCELLED },
      { status: previous },
    );
    throw err;
  }

  await bookingRepo.update(booking.id, { paymentStatus });
  return true;
}

export const updateBookingStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const { status } = req.body as { status: BookingStatus };

    if (!Object.values(BookingStatus).includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const booking = await bookingRepo.findOne({
      where: { id },
      relations: ["shop", "shop.owner"],
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.shop.owner.id !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (booking.status === status) {
      return res.json(booking);
    }
    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      return res.status(400).json({
        message: `This booking is already ${booking.status} and can't be changed`,
      });
    }
    if (status === BookingStatus.PENDING) {
      return res
        .status(400)
        .json({ message: "A booking can't be moved back to pending" });
    }

    if (status === BookingStatus.CONFIRMED) {
      if (!CONFIRMABLE_STATES.includes(booking.paymentStatus)) {
        return res.status(400).json({
          message:
            booking.paymentStatus === PaymentStatus.FAILED
              ? "The client's card was declined — this booking can't be confirmed until they complete payment"
              : "The client hasn't authorized payment for this booking yet",
        });
      }

      const claimed = await bookingRepo.update(
        { id, status: BookingStatus.PENDING },
        { status: BookingStatus.CONFIRMED },
      );
      if (!claimed.affected) return res.status(409).json(CONCURRENT_UPDATE);

      const intentId = booking.stripePaymentIntentId;
      if (booking.paymentStatus === PaymentStatus.AUTHORIZED && intentId) {
        try {
          await stripe.paymentIntents.capture(
            intentId,
            {},
            { idempotencyKey: `capture-${intentId}` },
          );
        } catch (err) {
          await bookingRepo.update(
            { id, status: BookingStatus.CONFIRMED },
            { status: BookingStatus.PENDING },
          );
          return res.status(409).json({
            message:
              "Couldn't charge the client's card — the authorization hold may have expired (holds last about 7 days). Ask the client to book again.",
            error: err instanceof Error ? err.message : err,
          });
        }
        await bookingRepo.update(id, { paymentStatus: PaymentStatus.PAID });
      }
    }

    if (status === BookingStatus.COMPLETED) {
      if (new Date(booking.scheduledAt).getTime() > Date.now()) {
        return res.status(400).json({
          message:
            "You can mark this booking completed once the appointment time has passed",
        });
      }
      const done = await bookingRepo.update(
        { id, status: BookingStatus.CONFIRMED },
        { status: BookingStatus.COMPLETED },
      );
      if (!done.affected) {
        return res
          .status(400)
          .json({ message: "Confirm the booking before marking it completed" });
      }
    }

    if (status === BookingStatus.CANCELLED) {
      if (!(await cancelBooking(booking))) {
        return res.status(409).json(CONCURRENT_UPDATE);
      }
    }

    // Reached only once the status change has gone through.
    notifyInBackground(() => notifyBookingUpdatedByShop(id));
    return res.json(await bookingRepo.findOne({ where: { id } }));
  } catch (error) {
    console.error("updateBookingStatus failed:", error);
    return res.status(500).json({ message: "Error updating booking" });
  }
};

export const cancelMyBooking = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const booking = await bookingRepo.findOne({
      where: { id },
      relations: ["client"],
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.client.id !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (booking.status === BookingStatus.CANCELLED) {
      return res.status(400).json({ message: "Booking is already cancelled" });
    }
    if (booking.status === BookingStatus.COMPLETED) {
      return res
        .status(400)
        .json({ message: "Can't cancel a completed booking" });
    }
    const blocked = clientCancellationBlock(booking);
    if (blocked) return res.status(400).json({ message: blocked });

    if (!(await cancelBooking(booking))) {
      return res.status(409).json(CONCURRENT_UPDATE);
    }
    // The artisan only knew about it once the card was held.
    if (!UNPAID_STATES.includes(booking.paymentStatus)) {
      notifyInBackground(() => notifyBookingCancelledByClient(id));
    }
    return res.json(await bookingRepo.findOne({ where: { id } }));
  } catch (error) {
    console.error("cancelMyBooking failed:", error);
    return res.status(500).json({ message: "Error cancelling booking" });
  }
};

/**
 * Closes one unpaid booking checkout. Stripe is asked first: if the card
 * actually went through, the booking is kept and marked accordingly.
 */
async function abandonUnpaidBooking(booking: Booking) {
  const outcome = await closeUnpaidIntent(booking.stripePaymentIntentId);
  if (outcome === "authorized") {
    await handleBookingIntentAuthorized(booking.id);
    return false;
  }
  if (outcome === "captured") {
    await handleBookingIntentCaptured(booking.id);
    return false;
  }
  if (outcome === "in_flight") return false;
  return discardUnpaidBooking(booking.id);
}

/**
 * The client backed out of the payment step — free the time slot now
 * instead of waiting for the expiry sweep.
 */
export const abandonMyBooking = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const booking = await bookingRepo.findOne({
      where: { id, client: { id: userId } },
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (
      booking.status !== BookingStatus.PENDING ||
      !UNPAID_STATES.includes(booking.paymentStatus)
    ) {
      return res.json({ discarded: false });
    }

    return res.json({ discarded: await abandonUnpaidBooking(booking) });
  } catch (error) {
    console.error("abandonMyBooking failed:", error);
    return res.status(500).json({ message: "Error cancelling booking" });
  }
};

/** Expiry sweep: unpaid bookings older than the checkout TTL. */
export async function expireStaleBookings(batchSize = 100) {
  const stale = await bookingRepo.find({
    where: {
      status: BookingStatus.PENDING,
      paymentStatus: In(UNPAID_STATES),
      createdAt: createdBeforeCheckoutTtl(),
    },
    order: { createdAt: "ASC" },
    take: batchSize,
  });

  let discarded = 0;
  for (const booking of stale) {
    try {
      if (await abandonUnpaidBooking(booking)) discarded++;
    } catch (err) {
      console.error("Couldn't close unpaid booking", booking.id, err);
    }
  }
  return discarded;
}

export const getAllBookingsAdmin = async (req: Request, res: Response) => {
  try {
    const { page, take, skip } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 200,
    });
    const status = statusFilter(req.query.status);
    const [bookings, total] = await bookingRepo.findAndCount({
      where: status ? { status } : {},
      relations: ["shop", "service", "client"],
      order: { createdAt: "DESC", id: "ASC" },
      skip,
      take,
    });
    return res.json(pageResult(bookings, total, page, take));
  } catch (error) {
    console.error("getAllBookingsAdmin failed:", error);
    return res.status(500).json({ message: "Error fetching bookings" });
  }
};

// ── Stripe webhook handlers ────────────────────────────────────────────────
// Every update is conditional on the current state, so late or out-of-order
// events can only move a booking *forward*.

async function handleBookingIntentAuthorized(bookingId: string) {
  // FAILED is included: a declined card followed by a successful retry
  // fires payment_failed and then this event on the same intent. Upgrading
  // only from UNPAID left those bookings stuck at FAILED, which the old
  // confirm check let through without ever capturing the hold.
  const upgraded = await bookingRepo.update(
    {
      id: bookingId,
      paymentStatus: In(UNPAID_STATES),
      status: Not(BookingStatus.CANCELLED),
    },
    { paymentStatus: PaymentStatus.AUTHORIZED, authorizedAt: new Date() },
  );
  // This is when the artisan has something to confirm. The update is
  // conditional and webhook events are de-duplicated, so this sends once.
  if (upgraded.affected) {
    notifyInBackground(() => notifyBookingAuthorized(bookingId));
  }
  // A booking cancelled before payment finished still gets its hold
  // recorded, so the release below can see it.
  await bookingRepo.update(
    {
      id: bookingId,
      paymentStatus: In(UNPAID_STATES),
      status: BookingStatus.CANCELLED,
    },
    { paymentStatus: PaymentStatus.AUTHORIZED },
  );

  // Cancelled before the client finished paying — release the hold.
  try {
    const booking = await bookingRepo.findOne({ where: { id: bookingId } });
    if (
      booking?.status === BookingStatus.CANCELLED &&
      booking.paymentStatus === PaymentStatus.AUTHORIZED &&
      booking.stripePaymentIntentId
    ) {
      await stripe.paymentIntents.cancel(booking.stripePaymentIntentId);
      await bookingRepo.update(
        { id: bookingId, paymentStatus: PaymentStatus.AUTHORIZED },
        { paymentStatus: PaymentStatus.UNPAID },
      );
    }
  } catch (err) {
    console.error("Couldn't release a hold on a cancelled booking:", bookingId, err);
  }
}

async function handleBookingIntentFailed(bookingId: string) {
  // Only a booking nobody has paid for can "fail" — a late failure event
  // must never knock an authorized booking back down.
  await bookingRepo.update(
    { id: bookingId, paymentStatus: PaymentStatus.UNPAID },
    { paymentStatus: PaymentStatus.FAILED },
  );
}

async function handleBookingIntentCaptured(bookingId: string) {
  await bookingRepo.update(
    {
      id: bookingId,
      status: Not(BookingStatus.CANCELLED),
      paymentStatus: In([...UNPAID_STATES, PaymentStatus.AUTHORIZED]),
    },
    { paymentStatus: PaymentStatus.PAID },
  );
  await bookingRepo.update(
    {
      id: bookingId,
      status: BookingStatus.PENDING,
      paymentStatus: PaymentStatus.PAID,
    },
    { status: BookingStatus.CONFIRMED },
  );
}

async function handleBookingIntentCanceled(bookingId: string) {
  const booking = await bookingRepo.findOne({ where: { id: bookingId } });
  if (!booking) return;

  const authorized = booking.paymentStatus === PaymentStatus.AUTHORIZED;
  if (
    booking.status === BookingStatus.PENDING &&
    UNPAID_STATES.includes(booking.paymentStatus)
  ) {
    await discardUnpaidBooking(booking.id);
  } else if (booking.status === BookingStatus.PENDING && authorized) {
    // The hold was released or expired (about 7 days) before the artisan
    // confirmed the booking.
    const expired = await bookingRepo.update(
      {
        id: bookingId,
        status: BookingStatus.PENDING,
        paymentStatus: PaymentStatus.AUTHORIZED,
      },
      { status: BookingStatus.CANCELLED, paymentStatus: PaymentStatus.UNPAID },
    );
    if (expired.affected) notifyInBackground(() => notifyBookingHoldExpired(bookingId));
  } else if (booking.status === BookingStatus.CANCELLED && authorized) {
    await bookingRepo.update(
      { id: bookingId, paymentStatus: PaymentStatus.AUTHORIZED },
      { paymentStatus: PaymentStatus.UNPAID },
    );
  }
}

type IntentEventHandler = (id: string) => Promise<void>;

const ORDER_EVENT_HANDLERS: Record<string, IntentEventHandler> = {
  "payment_intent.amount_capturable_updated": handleOrderIntentAuthorized,
  "payment_intent.succeeded": handleOrderIntentCaptured,
  "payment_intent.payment_failed": handleOrderIntentFailed,
  "payment_intent.canceled": handleOrderIntentCanceled,
};

const BOOKING_EVENT_HANDLERS: Record<string, IntentEventHandler> = {
  "payment_intent.amount_capturable_updated": handleBookingIntentAuthorized,
  "payment_intent.succeeded": handleBookingIntentCaptured,
  "payment_intent.payment_failed": handleBookingIntentFailed,
  "payment_intent.canceled": handleBookingIntentCanceled,
};

export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return res.status(400).json({ message: "Missing signature or secret" });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    return res.status(400).json({
      message: `Webhook signature verification failed: ${
        err instanceof Error ? err.message : err
      }`,
    });
  }

  try {
    try {
      await processedEventRepo.insert({ id: event.id });
    } catch {
      return res.json({ received: true, duplicate: true });
    }

    if (event.type.startsWith("payment_intent.")) {
      const intent = event.data.object as Stripe.PaymentIntent;
      const kind = intent.metadata?.type;

      if (kind === "order" || kind === "cart") {
        // Orders are found by PaymentIntent id, which covers single orders
        // and every line of a cart (older intents carry a CSV of order ids
        // in metadata; that isn't needed any more).
        await ORDER_EVENT_HANDLERS[event.type]?.(intent.id);
      } else if (isUuid(intent.metadata?.bookingId)) {
        await BOOKING_EVENT_HANDLERS[event.type]?.(intent.metadata.bookingId);
      }
    }

    return res.json({ received: true });
  } catch (error) {
    await processedEventRepo.delete({ id: event.id }).catch(() => undefined);
    console.error("Stripe webhook processing failed:", event.id, error);
    return res.status(500).json({ message: "Error handling webhook" });
  }
};

/**
 * Live bookings at a shop that overlap [from, to), with their service and
 * places — what the clash check in createBooking and the availability
 * endpoint both go by (abandoned unpaid ones don't count).
 */
async function liveBookingsBetween(
  shopId: string,
  from: Date,
  to: Date,
  manager: EntityManager = AppDataSource.manager,
) {
  const rows: { scheduledAt: Date; endsAt: Date | null; seats: number; serviceId: string | null }[] =
    await manager.query(
      `SELECT "scheduledAt", "endsAt", seats, "serviceId"
         FROM bookings
        WHERE "shopId" = $1
          AND status::text = ANY($2)
          AND "scheduledAt" < $4
          AND COALESCE("endsAt", "scheduledAt" + interval '${DEFAULT_SLOT_MINUTES} minute') > $3
          AND ("paymentStatus"::text <> ALL($5) OR ${withinCheckoutTtlSql('"createdAt"')})`,
      [shopId, LIVE_STATUSES, from, to, UNPAID_STATES],
    );
  return rows.map((b) => {
    const start = new Date(b.scheduledAt);
    return {
      start,
      end: b.endsAt ? new Date(b.endsAt) : new Date(start.getTime() + DEFAULT_SLOT_MINUTES * 60_000),
      seats: Number(b.seats ?? 1),
      serviceId: b.serviceId,
    };
  });
}

/** The earliest and latest start a shop accepts right now (ms since epoch). */
function bookingWindow(
  shop: { bookingMinNoticeHours?: number | null; bookingMaxDaysAhead?: number | null },
  now: number,
) {
  const noticeMs = Math.max(0, shop.bookingMinNoticeHours ?? 0) * 60 * 60 * 1000;
  const aheadMs = Math.min(
    MAX_BOOKING_AHEAD_MS,
    Math.max(1, shop.bookingMaxDaysAhead ?? 365) * 24 * 60 * 60 * 1000,
  );
  return { earliest: now + noticeMs, latest: now + aheadMs };
}

/** Slot length offered for services without an appointment length. */
const UNTIMED_SLOT_MINUTES = 30;

/**
 * GET /services/:id/availability?date=YYYY-MM-DD — the free start times on
 * that day (in the shop's time zone), for shops with opening hours.
 */
export const getServiceAvailability = async (req: Request, res: Response) => {
  try {
    const date = String(req.query.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
      return res.status(400).json({ message: "Choose a date", field: "date" });
    }

    const service = await serviceRepo.findOne({
      where: { id: String(req.params.id), archivedAt: IsNull() },
      relations: ["shop"],
    });
    if (!service || !service.isAvailable || service.shop.status !== ShopStatus.ACTIVE) {
      return res.status(404).json({ message: "Service not found" });
    }

    const { shop } = service;
    const timezone = shop.timezone || "UTC";
    if (!hasOpeningHours(shop.openingHours)) {
      return res.json({ date, timezone, hasOpeningHours: false, slots: [] });
    }

    const durationMinutes = service.durationMinutes ?? UNTIMED_SLOT_MINUTES;
    const window = dayWindow(date, timezone);
    const { earliest: noticeEarliest, latest } = bookingWindow(shop, Date.now());
    // Away on holiday: nothing before the return date.
    const earliest = Math.max(noticeEarliest, shop.holidayUntil?.getTime() ?? 0);
    const tooFar = window.start.getTime() > latest;
    const capacity = Math.max(1, service.capacity ?? 1);
    const booked = tooFar ? [] : await liveBookingsBetween(shop.id, window.start, window.end);

    // A class's sessions: places taken per start time. A session with room
    // left stays bookable even though it "overlaps" its own bookings.
    const sessions = new Map<number, number>();
    if (capacity > 1) {
      for (const b of booked) {
        if (b.serviceId === service.id) sessions.set(b.start.getTime(), (sessions.get(b.start.getTime()) ?? 0) + b.seats);
      }
    }
    const busy: Interval[] = booked.map((b) => ({ start: b.start, end: b.end }));
    const free = tooFar
      ? []
      : slotsForDate({
          hours: shop.openingHours,
          tz: timezone,
          date,
          durationMinutes,
          stepMinutes: Math.min(30, durationMinutes),
          busy,
          notBefore: new Date(earliest - 1),
        });

    const starts = new Set(free.map((slot) => slot.getTime()));
    if (capacity > 1) {
      const end = (start: number) => start + durationMinutes * 60_000;
      for (const [start, taken] of sessions) {
        if (taken >= capacity || start < earliest) continue;
        // Bookable only if nothing *else* (another service, or another
        // session of this one) overlaps it.
        const blocked = booked.some(
          (b) =>
            !(b.serviceId === service.id && b.start.getTime() === start) &&
            b.start.getTime() < end(start) &&
            b.end.getTime() > start,
        );
        if (!blocked) starts.add(start);
      }
    }
    const slots = [...starts].sort((a, b) => a - b);

    return res.json({
      date,
      timezone,
      hasOpeningHours: true,
      durationMinutes,
      capacity,
      slots: slots.map((slot) => new Date(slot).toISOString()),
      // Places left per start time, for classes.
      ...(capacity > 1
        ? { seatsLeft: Object.fromEntries(slots.map((s) => [new Date(s).toISOString(), capacity - (sessions.get(s) ?? 0)])) }
        : {}),
    });
  } catch (error) {
    console.error("getServiceAvailability failed:", error);
    return res.status(500).json({ message: "Couldn't load available times" });
  }
};

/**
 * Day-before reminders for confirmed appointments (once each; skipped for
 * bookings made in the last hour — they were just confirmed by email).
 */
export async function sendBookingReminders() {
  const due: { id: string }[] = await AppDataSource.query(
    `UPDATE bookings SET "reminderSentAt" = now()
      WHERE status = 'confirmed' AND "reminderSentAt" IS NULL
        AND "scheduledAt" > now() AND "scheduledAt" <= now() + interval '24 hours'
        AND "createdAt" < now() - interval '1 hour'
      RETURNING id`,
  ).then((r) => (Array.isArray(r[0]) ? r[0] : r));
  for (const { id } of due) notifyInBackground(() => notifyBookingReminder(id));
  return due.length;
}

/**
 * Confirmed appointments that ended over a day ago become "completed" — so
 * the client can review — unless the artisan already marked them. Only
 * recent ones prompt the client (older ones are tidied up silently).
 */
export async function autoCompleteBookings() {
  const done: { id: string; recent: boolean }[] = await AppDataSource.query(
    `UPDATE bookings SET status = 'completed', "updatedAt" = now()
      WHERE status = 'confirmed'
        AND COALESCE("endsAt", "scheduledAt") < now() - interval '24 hours'
      RETURNING id, COALESCE("endsAt", "scheduledAt") > now() - interval '8 days' AS recent`,
  ).then((r) => (Array.isArray(r[0]) ? r[0] : r));
  for (const { id, recent } of done) {
    if (recent) notifyInBackground(() => notifyBookingCompleted(id));
  }
  return done.length;
}

/** Reminds artisans ~2 days before the hold lapses on a booking they haven't confirmed. */
export async function sendBookingHoldReminders() {
  const due: { id: string }[] = await AppDataSource.query(
    `UPDATE bookings SET "holdReminderSentAt" = now()
      WHERE status = 'pending' AND "paymentStatus" = 'authorized' AND "holdReminderSentAt" IS NULL
        AND COALESCE("authorizedAt", "createdAt") < now() - interval '5 days'
      RETURNING id`,
  ).then((r) => (Array.isArray(r[0]) ? r[0] : r));
  for (const { id } of due) notifyInBackground(() => notifyBookingHoldExpiring(id));
  return due.length;
}

const INTENT_STATUS_EVENTS: Record<string, string> = {
  canceled: "payment_intent.canceled",
  succeeded: "payment_intent.succeeded",
};

/**
 * Safety net for missed webhooks: holds older than ~7 days that we still
 * show as "on hold" are checked with Stripe, and whatever Stripe says
 * happened (dropped, or captured) is applied as if the event had arrived.
 */
export async function reconcileStaleHolds(limit = 25) {
  let fixed = 0;
  const stale = `COALESCE("authorizedAt", "createdAt") < now() - interval '7 days 6 hours'`;
  const orderIntents: { id: string }[] = await AppDataSource.query(
    `SELECT DISTINCT "stripePaymentIntentId" AS id FROM orders
      WHERE "paymentStatus" = 'authorized' AND "stripePaymentIntentId" IS NOT NULL AND ${stale}
      LIMIT $1`,
    [limit],
  );
  for (const { id } of orderIntents) {
    const intent = await stripe.paymentIntents.retrieve(id);
    const handler = ORDER_EVENT_HANDLERS[INTENT_STATUS_EVENTS[intent.status] ?? ""];
    if (handler) {
      await handler(id);
      fixed++;
    }
  }
  const bookings: { id: string; intent: string }[] = await AppDataSource.query(
    `SELECT id, "stripePaymentIntentId" AS intent FROM bookings
      WHERE "paymentStatus" = 'authorized' AND "stripePaymentIntentId" IS NOT NULL AND ${stale}
      LIMIT $1`,
    [limit],
  );
  for (const booking of bookings) {
    const intent = await stripe.paymentIntents.retrieve(booking.intent);
    const handler = BOOKING_EVENT_HANDLERS[INTENT_STATUS_EVENTS[intent.status] ?? ""];
    if (handler) {
      await handler(booking.id);
      fixed++;
    }
  }
  return fixed;
}
