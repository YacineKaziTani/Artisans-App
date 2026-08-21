import { Request, Response } from "express";
import Stripe from "stripe";
import { In } from "typeorm";
import { AppDataSource } from "../../data-source";
import { Booking, BookingStatus, PaymentStatus } from "./booking.entities";
import { Shop } from "../shop/shop.entities";
import { Service } from "../services/service.entities";
import { User } from "../users/entities/user.entities";
import { stripe } from "../../config/stripe";
import { handleOrderPaymentEvent } from "../orders/order.controller";
import { ProcessedWebhookEvent } from "../webhook-events/webhook-event.entities";

const processedEventRepo = AppDataSource.getRepository(ProcessedWebhookEvent);

const bookingRepo = AppDataSource.getRepository(Booking);
const shopRepo = AppDataSource.getRepository(Shop);
const serviceRepo = AppDataSource.getRepository(Service);

// Client creates a booking request for a shop's service, and gets back a
// Stripe PaymentIntent client secret to pay for it.
export const createBooking = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { serviceId, scheduledAt, notes } = req.body;

    if (!serviceId || !scheduledAt) {
      return res
        .status(400)
        .json({ message: "serviceId and scheduledAt are required" });
    }

    const service = await serviceRepo.findOne({
      where: { id: serviceId },
      relations: ["shop"],
    });
    if (!service || !service.isAvailable) {
      return res.status(404).json({ message: "Service not found" });
    }

    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      return res
        .status(400)
        .json({ message: "scheduledAt must be a valid future date" });
    }

    // Guard against two clients booking the exact same slot on the same shop.
    // (Service.duration is free text, not a structured time range, so this
    // only catches literal same-instant collisions rather than overlaps.)
    const conflict = await bookingRepo.findOne({
      where: {
        shop: { id: service.shop.id },
        scheduledAt: scheduledDate,
        status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
      },
    });
    if (conflict) {
      return res.status(409).json({
        message: "This shop already has a booking at that exact time",
      });
    }

    const booking = bookingRepo.create({
      client: { id: userId } as User,
      shop: service.shop,
      service,
      scheduledAt: scheduledDate,
      notes,
      totalAmount: service.price,
      status: BookingStatus.PENDING,
      paymentStatus: PaymentStatus.UNPAID,
    });
    const saved = await bookingRepo.save(booking);

    const amountInCents = Math.round(Number(service.price) * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      metadata: { type: "booking", bookingId: saved.id },
      automatic_payment_methods: { enabled: true },
    });

    saved.stripePaymentIntentId = paymentIntent.id;
    await bookingRepo.save(saved);

    return res.status(201).json({
      booking: saved,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error creating booking", error });
  }
};

// The client's own bookings (as the person who booked)
export const getMyBookings = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const bookings = await bookingRepo.find({
      where: { client: { id: userId } },
      relations: ["shop", "service"],
      order: { createdAt: "DESC" },
    });
    return res.json(bookings);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching bookings", error });
  }
};

// Bookings placed against the logged-in artisan's own shop
export const getShopBookings = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const shop = await shopRepo.findOne({ where: { owner: { id: userId } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const bookings = await bookingRepo.find({
      where: { shop: { id: shop.id } },
      relations: ["service", "client"],
      order: { createdAt: "DESC" },
    });
    return res.json(bookings);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching bookings", error });
  }
};

// Artisan confirms, completes, or cancels a booking on their own shop.
// Cancelling a paid booking triggers a Stripe refund.
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

    if (
      status === BookingStatus.CANCELLED &&
      booking.paymentStatus === PaymentStatus.PAID &&
      booking.stripePaymentIntentId
    ) {
      await stripe.refunds.create({
        payment_intent: booking.stripePaymentIntentId,
      });
      booking.paymentStatus = PaymentStatus.REFUNDED;
    }

    booking.status = status;
    const saved = await bookingRepo.save(booking);
    return res.json(saved);
  } catch (error) {
    return res.status(500).json({ message: "Error updating booking", error });
  }
};

// Client cancels their own booking (refunds automatically if it was paid)
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

    if (
      booking.paymentStatus === PaymentStatus.PAID &&
      booking.stripePaymentIntentId
    ) {
      await stripe.refunds.create({
        payment_intent: booking.stripePaymentIntentId,
      });
      booking.paymentStatus = PaymentStatus.REFUNDED;
    }

    booking.status = BookingStatus.CANCELLED;
    const saved = await bookingRepo.save(booking);
    return res.json(saved);
  } catch (error) {
    return res.status(500).json({ message: "Error cancelling booking", error });
  }
};

// All bookings across the platform (super_admin oversight)
export const getAllBookingsAdmin = async (req: Request, res: Response) => {
  try {
    const bookings = await bookingRepo.find({
      relations: ["shop", "service", "client"],
      order: { createdAt: "DESC" },
    });
    return res.json(bookings);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching bookings", error });
  }
};

// Stripe webhook — marks bookings paid/failed based on PaymentIntent events.
// Mounted with a raw body parser, before the global JSON parser.
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
    // Idempotency: Stripe retries webhook deliveries on timeout or non-2xx
    // responses, so the same event.id can arrive more than once. Insert
    // first — the unique primary key rejects a duplicate insert, so we know
    // to skip processing without a race between a separate check-then-insert.
    try {
      await processedEventRepo.insert({ id: event.id });
    } catch {
      return res.json({ received: true, duplicate: true });
    }

    if (
      event.type === "payment_intent.succeeded" ||
      event.type === "payment_intent.payment_failed"
    ) {
      const intent = event.data.object as Stripe.PaymentIntent;
      const succeeded = event.type === "payment_intent.succeeded";

      if (
        (intent.metadata?.type === "order" && intent.metadata?.orderId) ||
        (intent.metadata?.type === "cart" && intent.metadata?.orderIds)
      ) {
        const idsCsv =
          intent.metadata.type === "cart"
            ? intent.metadata.orderIds
            : intent.metadata.orderId;
        await handleOrderPaymentEvent(idsCsv, succeeded);
      } else if (intent.metadata?.bookingId) {
        const booking = await bookingRepo.findOne({
          where: { id: intent.metadata.bookingId },
        });
        if (booking) {
          if (succeeded) {
            booking.paymentStatus = PaymentStatus.PAID;
            booking.status = BookingStatus.CONFIRMED;
          } else {
            booking.paymentStatus = PaymentStatus.FAILED;
          }
          await bookingRepo.save(booking);
        }
      }
    }
    return res.json({ received: true });
  } catch (error) {
    return res.status(500).json({ message: "Error handling webhook", error });
  }
};
