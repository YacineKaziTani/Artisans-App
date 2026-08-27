import { Request, Response } from "express";
import Stripe from "stripe";
import { In } from "typeorm";
import { AppDataSource } from "../../data-source";
import { Booking, BookingStatus, PaymentStatus } from "./booking.entities";
import { Shop, ShopStatus } from "../shop/shop.entities";
import { Service } from "../services/service.entities";
import { User } from "../users/entities/user.entities";
import { parsePagination } from "../../middleware/validate.middleware";
import {
  stripe,
  shopCanAcceptPayments,
  connectChargeParams,
  connectRefundParams,
} from "../../config/stripe";
import {
  handleOrderPaymentEvent,
  handleOrderAuthorizedEvent,
} from "../orders/order.controller";
import { ProcessedWebhookEvent } from "../webhook-events/webhook-event.entities";

const processedEventRepo = AppDataSource.getRepository(ProcessedWebhookEvent);

const bookingRepo = AppDataSource.getRepository(Booking);
const shopRepo = AppDataSource.getRepository(Shop);
const serviceRepo = AppDataSource.getRepository(Service);

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

    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      return res
        .status(400)
        .json({ message: "scheduledAt must be a valid future date" });
    }

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
      capture_method: "manual",
      metadata: { type: "booking", bookingId: saved.id },
      automatic_payment_methods: { enabled: true },
      ...connectChargeParams(service.shop, amountInCents),
    });

    saved.stripePaymentIntentId = paymentIntent.id;
    await bookingRepo.save(saved);

    return res.status(201).json({
      booking: saved,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error creating booking" });
  }
};

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
    return res.status(500).json({ message: "Error fetching bookings" });
  }
};

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
    return res.status(500).json({ message: "Error fetching bookings" });
  }
};

async function releaseHold(stripePaymentIntentId: string) {
  await stripe.paymentIntents.cancel(stripePaymentIntentId);
}

async function captureHold(stripePaymentIntentId: string) {
  await stripe.paymentIntents.capture(stripePaymentIntentId);
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
    if (
      status === BookingStatus.COMPLETED &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      return res
        .status(400)
        .json({ message: "Confirm the booking before marking it completed" });
    }

    if (status === BookingStatus.CONFIRMED) {
      if (
        booking.paymentStatus === PaymentStatus.AUTHORIZED &&
        booking.stripePaymentIntentId
      ) {
        try {
          await captureHold(booking.stripePaymentIntentId);
        } catch (err) {
          return res.status(409).json({
            message:
              "Couldn't charge the client's card — the authorization hold may have expired (holds last about 7 days). Ask the client to book again.",
            error: err instanceof Error ? err.message : err,
          });
        }
        booking.paymentStatus = PaymentStatus.PAID;
      } else if (booking.paymentStatus === PaymentStatus.UNPAID) {
        return res.status(400).json({
          message: "The client hasn't authorized payment for this booking yet",
        });
      }
    }

    if (status === BookingStatus.CANCELLED) {
      if (
        booking.paymentStatus === PaymentStatus.AUTHORIZED &&
        booking.stripePaymentIntentId
      ) {
        await releaseHold(booking.stripePaymentIntentId);
        booking.paymentStatus = PaymentStatus.UNPAID;
      } else if (
        booking.paymentStatus === PaymentStatus.PAID &&
        booking.stripePaymentIntentId
      ) {
        await stripe.refunds.create({
          payment_intent: booking.stripePaymentIntentId,
          ...connectRefundParams(),
        });
        booking.paymentStatus = PaymentStatus.REFUNDED;
      }
    }

    booking.status = status;
    const saved = await bookingRepo.save(booking);
    return res.json(saved);
  } catch (error) {
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

    if (
      booking.paymentStatus === PaymentStatus.AUTHORIZED &&
      booking.stripePaymentIntentId
    ) {
      await releaseHold(booking.stripePaymentIntentId);
      booking.paymentStatus = PaymentStatus.UNPAID;
    } else if (
      booking.paymentStatus === PaymentStatus.PAID &&
      booking.stripePaymentIntentId
    ) {
      await stripe.refunds.create({
        payment_intent: booking.stripePaymentIntentId,
        ...connectRefundParams(),
      });
      booking.paymentStatus = PaymentStatus.REFUNDED;
    }

    booking.status = BookingStatus.CANCELLED;
    const saved = await bookingRepo.save(booking);
    return res.json(saved);
  } catch (error) {
    return res.status(500).json({ message: "Error cancelling booking" });
  }
};

export const getAllBookingsAdmin = async (req: Request, res: Response) => {
  try {
    const { page, take, skip } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 200,
    });
    const [bookings, total] = await bookingRepo.findAndCount({
      relations: ["shop", "service", "client"],
      order: { createdAt: "DESC" },
      skip,
      take,
    });
    return res.json({
      data: bookings,
      meta: { total, page, lastPage: Math.ceil(total / take) },
    });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching bookings" });
  }
};

export async function handleBookingAuthorizedEvent(bookingId: string) {
  const booking = await bookingRepo.findOne({ where: { id: bookingId } });
  if (!booking) return;
  if (booking.paymentStatus === PaymentStatus.UNPAID) {
    booking.paymentStatus = PaymentStatus.AUTHORIZED;
    await bookingRepo.save(booking);
  }
}

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

    const relevantTypes = [
      "payment_intent.amount_capturable_updated",
      "payment_intent.succeeded",
      "payment_intent.payment_failed",
    ];

    if (relevantTypes.includes(event.type)) {
      const intent = event.data.object as Stripe.PaymentIntent;
      const isAuthorized =
        event.type === "payment_intent.amount_capturable_updated";
      const isCaptured = event.type === "payment_intent.succeeded";
      const isFailed = event.type === "payment_intent.payment_failed";

      const isOrder =
        (intent.metadata?.type === "order" && intent.metadata?.orderId) ||
        (intent.metadata?.type === "cart" && intent.metadata?.orderIds);

      if (isOrder) {
        const idsCsv =
          intent.metadata.type === "cart"
            ? intent.metadata.orderIds
            : intent.metadata.orderId;
        if (isAuthorized) await handleOrderAuthorizedEvent(idsCsv);
        else if (isCaptured || isFailed)
          await handleOrderPaymentEvent(idsCsv, isCaptured);
      } else if (intent.metadata?.bookingId) {
        if (isAuthorized) {
          await handleBookingAuthorizedEvent(intent.metadata.bookingId);
        } else if (isCaptured || isFailed) {
          const booking = await bookingRepo.findOne({
            where: { id: intent.metadata.bookingId },
          });
          if (booking) {
            if (isCaptured) {
              booking.paymentStatus = PaymentStatus.PAID;
              if (booking.status === BookingStatus.PENDING) {
                booking.status = BookingStatus.CONFIRMED;
              }
            } else {
              booking.paymentStatus = PaymentStatus.FAILED;
            }
            await bookingRepo.save(booking);
          }
        }
      }
    }

    return res.json({ received: true });
  } catch (error) {
    await processedEventRepo.delete({ id: event.id }).catch(() => undefined);
    console.error("Stripe webhook processing failed:", event.id, error);
    return res.status(500).json({ message: "Error handling webhook" });
  }
};
