import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Dispute, DisputeStatus, DisputeTargetType } from "./dispute.entities";
import {
  Booking,
  PaymentStatus,
  BookingStatus,
} from "../booking/booking.entities";
import {
  Order,
  OrderPaymentStatus,
  OrderStatus,
} from "../orders/order.entities";
import {
  refundScopeFor,
  claimOrderCancellation,
  releaseOrderCancellation,
  settleCheckoutGroup,
} from "../orders/order.controller";
import { restoreOrderStock } from "../products/stock";
import { User } from "../users/entities/user.entities";
import { accountView } from "../users/user.views";
import { In } from "typeorm";
import { stripe, connectRefundParams } from "../../config/stripe";
import { toCents } from "../../lib/money";
import { notifyInBackground } from "../../notifications/deliver";
import { notifyDisputeOpened, notifyDisputeResolved } from "../../notifications";
import {
  pageResult,
  parsePagination,
  queryString,
} from "../../middleware/validate.middleware";

// Request bodies are validated by the zod schemas in dispute.schemas.ts.

const disputeRepo = AppDataSource.getRepository(Dispute);
const bookingRepo = AppDataSource.getRepository(Booking);
const orderRepo = AppDataSource.getRepository(Order);

async function findTargetForParticipant(
  targetType: DisputeTargetType,
  targetId: string,
  userId: string,
) {
  if (targetType === DisputeTargetType.BOOKING) {
    const booking = await bookingRepo.findOne({
      where: { id: targetId },
      relations: ["client", "shop", "shop.owner"],
    });
    if (!booking) return { target: null, allowed: false };
    const allowed =
      booking.client.id === userId || booking.shop.owner.id === userId;
    return { target: booking, allowed };
  }

  const order = await orderRepo.findOne({
    where: { id: targetId },
    relations: ["client", "shop", "shop.owner"],
  });
  if (!order) return { target: null, allowed: false };
  const allowed = order.client.id === userId || order.shop.owner.id === userId;
  return { target: order, allowed };
}

export const createDispute = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { targetType, targetId, reason } = req.body as {
      targetType: DisputeTargetType;
      targetId: string;
      reason: string;
    };

    const { target, allowed } = await findTargetForParticipant(
      targetType,
      targetId,
      userId,
    );
    if (!target) {
      return res.status(404).json({ message: `${targetType} not found` });
    }
    if (!allowed) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const existing = await disputeRepo.findOne({
      where: { targetType, targetId, status: DisputeStatus.OPEN },
    });
    if (existing) {
      return res
        .status(409)
        .json({ message: "There's already an open dispute for this" });
    }

    const dispute = disputeRepo.create({
      targetType,
      targetId,
      reason,
      raisedBy: { id: userId } as User,
    });
    const saved = await disputeRepo.save(dispute);
    notifyInBackground(() => notifyDisputeOpened(saved.id));

    return res.status(201).json(saved);
  } catch (error) {
    console.error("createDispute failed:", error);
    return res.status(500).json({ message: "Error opening dispute" });
  }
};

export const getMyDisputes = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const disputes = await disputeRepo.find({
      where: { raisedBy: { id: userId } },
      order: { createdAt: "DESC" },
    });
    return res.json(disputes);
  } catch (error) {
    console.error("getMyDisputes failed:", error);
    return res.status(500).json({ message: "Error fetching disputes" });
  }
};

export const getAllDisputesAdmin = async (req: Request, res: Response) => {
  try {
    const status = queryString(req.query.status) as DisputeStatus | undefined;
    const where =
      status && Object.values(DisputeStatus).includes(status) ? { status } : {};
    const { page, take, skip } = parsePagination(req.query, {
      defaultLimit: 25,
      maxLimit: 100,
    });
    const [disputes, total] = await disputeRepo.findAndCount({
      where,
      relations: ["raisedBy"],
      order: { createdAt: "DESC", id: "ASC" },
      skip,
      take,
    });

    // Admins used to see only "order #1a2b3c4d". Attach what was bought,
    // the amounts and states, and both parties' contact details — enough
    // to decide a refund without digging through other screens.
    const idsOf = (type: DisputeTargetType) =>
      disputes.filter((d) => d.targetType === type).map((d) => d.targetId);
    const bookingIds = idsOf(DisputeTargetType.BOOKING);
    const orderIds = idsOf(DisputeTargetType.ORDER);
    const [bookings, orders] = await Promise.all([
      bookingIds.length
        ? bookingRepo.find({
            where: { id: In(bookingIds) },
            relations: ["client", "shop", "shop.owner", "service"],
          })
        : [],
      orderIds.length
        ? orderRepo.find({
            where: { id: In(orderIds) },
            relations: ["client", "shop", "shop.owner", "product"],
          })
        : [],
    ]);

    const party = (user?: User | null) => (user ? accountView(user) : null);
    const summaries = new Map<string, Record<string, unknown>>();
    for (const b of bookings) {
      summaries.set(b.id, {
        id: b.id,
        title: b.service?.name ?? "Booking",
        scheduledAt: b.scheduledAt,
        status: b.status,
        paymentStatus: b.paymentStatus,
        totalAmount: b.totalAmount,
        createdAt: b.createdAt,
        shop: { id: b.shop.id, shopName: b.shop.shopName, owner: party(b.shop.owner) },
        client: party(b.client),
      });
    }
    for (const o of orders) {
      summaries.set(o.id, {
        id: o.id,
        title: `${o.quantity} × ${o.product?.title ?? o.title ?? "item"}${o.variantLabel ? ` (${o.variantLabel})` : ""}`,
        status: o.status,
        paymentStatus: o.paymentStatus,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt,
        deliveryMethod: o.deliveryMethod,
        partOfCart: Boolean(o.checkoutGroupId),
        shop: { id: o.shop.id, shopName: o.shop.shopName, owner: party(o.shop.owner) },
        client: party(o.client),
      });
    }

    const detailed = disputes.map((d) => ({
      ...d,
      raisedBy: party(d.raisedBy),
      target: summaries.get(d.targetId) ?? null,
    }));
    return res.json(pageResult(detailed, total, page, take));
  } catch (error) {
    console.error("getAllDisputesAdmin failed:", error);
    return res.status(500).json({ message: "Error fetching disputes" });
  }
};

export const resolveDispute = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, resolutionNote, refundAmount } = req.body as {
      status: DisputeStatus;
      resolutionNote?: string;
      refundAmount?: number;
    };

    const dispute = await disputeRepo.findOne({ where: { id } });
    if (!dispute) return res.status(404).json({ message: "Dispute not found" });
    if (dispute.status !== DisputeStatus.OPEN) {
      return res.status(400).json({ message: "Dispute is already resolved" });
    }

    // All refund arithmetic in integer cents.
    const refundCents =
      refundAmount !== undefined ? toCents(refundAmount) : undefined;

    if (status === DisputeStatus.RESOLVED_REFUNDED) {
      const target =
        dispute.targetType === DisputeTargetType.BOOKING
          ? await bookingRepo.findOne({ where: { id: dispute.targetId } })
          : await orderRepo.findOne({ where: { id: dispute.targetId } });
      if (!target) {
        return res.status(404).json({ message: `${dispute.targetType} not found` });
      }
      const paidStates: string[] = [PaymentStatus.AUTHORIZED, PaymentStatus.PAID];
      if (!target.stripePaymentIntentId || !paidStates.includes(target.paymentStatus)) {
        return res.status(400).json({
          message: `Nothing to refund — this ${dispute.targetType}'s payment is ${target.paymentStatus.replace("_", " ")}`,
        });
      }
      const totalCents = toCents(target.totalAmount);
      if (refundCents !== undefined && refundCents > totalCents) {
        return res.status(400).json({
          message: `The refund can't be more than the $${(totalCents / 100).toFixed(2)} that was paid`,
          field: "refundAmount",
        });
      }

      if (dispute.targetType === DisputeTargetType.BOOKING) {
        const booking = await bookingRepo.findOne({
          where: { id: dispute.targetId },
        });
        if (
          booking?.stripePaymentIntentId &&
          booking.paymentStatus === PaymentStatus.AUTHORIZED
        ) {
          await stripe.paymentIntents.cancel(booking.stripePaymentIntentId);
          booking.paymentStatus = PaymentStatus.UNPAID;
          booking.status = BookingStatus.CANCELLED;
          await bookingRepo.save(booking);
        } else if (
          booking &&
          booking.paymentStatus === PaymentStatus.PAID &&
          booking.stripePaymentIntentId
        ) {
          const isPartial =
            refundCents !== undefined && refundCents < toCents(booking.totalAmount);
          await stripe.refunds.create({
            payment_intent: booking.stripePaymentIntentId,
            ...connectRefundParams(!isPartial),
            ...(isPartial ? { amount: refundCents } : {}),
          });
          booking.paymentStatus = isPartial
            ? PaymentStatus.PARTIALLY_REFUNDED
            : PaymentStatus.REFUNDED;
          if (!isPartial) booking.status = BookingStatus.CANCELLED;
          await bookingRepo.save(booking);
        }
      } else {
        const order = await orderRepo.findOne({
          where: { id: dispute.targetId },
          relations: ["variant"],
        });
        const intentId = order?.stripePaymentIntentId;
        const groupId = order?.checkoutGroupId;

        if (
          order &&
          intentId &&
          order.paymentStatus === OrderPaymentStatus.AUTHORIZED
        ) {
          // Claim the row before touching Stripe so a concurrent cancel (or
          // the canceled webhook) can't restore the stock a second time.
          const previous = order.status;
          if (
            previous !== OrderStatus.CANCELLED &&
            (await claimOrderCancellation(order.id, [previous]))
          ) {
            if (!groupId) {
              try {
                await stripe.paymentIntents.cancel(intentId);
              } catch (err) {
                await releaseOrderCancellation(order.id, previous);
                throw err;
              }
              await orderRepo.update(order.id, {
                paymentStatus: OrderPaymentStatus.UNPAID,
              });
            }
            // In a cart the hold covers every line, so this one stays
            // AUTHORIZED until the group settles and releases its share.
            // (Setting it to UNPAID here used to stop the rest of the cart
            // from ever being captured.)
            await restoreOrderStock(order);
          }
          if (groupId) {
            try {
              await settleCheckoutGroup(groupId);
            } catch (err) {
              // The refund decision stands; the artisan hits the settlement
              // error (and can retry it) when they act on the other lines.
              console.error("Settling checkout group after dispute failed:", groupId, err);
            }
          }
        } else if (
          order &&
          intentId &&
          order.paymentStatus === OrderPaymentStatus.PAID
        ) {
          const isPartial =
            refundCents !== undefined && refundCents < toCents(order.totalAmount);
          const previous = order.status;
          const claimed =
            !isPartial &&
            previous !== OrderStatus.CANCELLED &&
            (await claimOrderCancellation(order.id, [previous]));

          try {
            await stripe.refunds.create({
              payment_intent: intentId,
              ...refundScopeFor(order),
              ...connectRefundParams(!isPartial && !groupId),
              ...(isPartial ? { amount: refundCents } : {}),
            });
          } catch (err) {
            if (claimed) await releaseOrderCancellation(order.id, previous);
            throw err;
          }

          await orderRepo.update(order.id, {
            paymentStatus: isPartial
              ? OrderPaymentStatus.PARTIALLY_REFUNDED
              : OrderPaymentStatus.REFUNDED,
          });
          if (claimed) {
            await restoreOrderStock(order);
          }
        }
      }
    }

    dispute.status = status;
    dispute.resolutionNote = resolutionNote;
    const saved = await disputeRepo.save(dispute);
    notifyInBackground(() => notifyDisputeResolved(saved.id));

    return res.json(saved);
  } catch (error) {
    console.error("resolveDispute failed:", error);
    return res.status(500).json({ message: "Error resolving dispute" });
  }
};
