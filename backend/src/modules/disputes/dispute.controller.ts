import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Dispute, DisputeStatus, DisputeTargetType } from "./dispute.entities";
import { Booking, PaymentStatus, BookingStatus } from "../booking/booking.entities";
import { Order, OrderPaymentStatus, OrderStatus } from "../orders/order.entities";
import { User } from "../users/entities/user.entities";
import { stripe } from "../../config/stripe";

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

// Client or artisan opens a dispute on a booking or order they're part of.
export const createDispute = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { targetType, targetId, reason } = req.body;

    if (!Object.values(DisputeTargetType).includes(targetType)) {
      return res.status(400).json({ message: "Invalid targetType" });
    }
    if (!targetId || !reason?.trim()) {
      return res
        .status(400)
        .json({ message: "targetId and reason are required" });
    }

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
      reason: reason.trim(),
      raisedBy: { id: userId } as User,
    });
    const saved = await disputeRepo.save(dispute);

    return res.status(201).json(saved);
  } catch (error) {
    return res.status(500).json({ message: "Error opening dispute", error });
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
    return res.status(500).json({ message: "Error fetching disputes", error });
  }
};

export const getAllDisputesAdmin = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const where = status ? { status: status as DisputeStatus } : {};
    const disputes = await disputeRepo.find({
      where,
      relations: ["raisedBy"],
      order: { createdAt: "DESC" },
    });
    return res.json(disputes);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching disputes", error });
  }
};

// Admin resolves a dispute. Resolving as "refunded" actually triggers the
// Stripe refund and updates the underlying booking/order — a dispute
// resolution isn't just a label, it has real financial effect.
export const resolveDispute = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, resolutionNote } = req.body as {
      status: DisputeStatus;
      resolutionNote?: string;
    };

    if (
      ![
        DisputeStatus.RESOLVED_REFUNDED,
        DisputeStatus.RESOLVED_DENIED,
        DisputeStatus.RESOLVED_OTHER,
      ].includes(status)
    ) {
      return res.status(400).json({ message: "Invalid resolution status" });
    }

    const dispute = await disputeRepo.findOne({ where: { id } });
    if (!dispute) return res.status(404).json({ message: "Dispute not found" });
    if (dispute.status !== DisputeStatus.OPEN) {
      return res.status(400).json({ message: "Dispute is already resolved" });
    }

    if (status === DisputeStatus.RESOLVED_REFUNDED) {
      if (dispute.targetType === DisputeTargetType.BOOKING) {
        const booking = await bookingRepo.findOne({
          where: { id: dispute.targetId },
        });
        if (
          booking &&
          booking.paymentStatus === PaymentStatus.PAID &&
          booking.stripePaymentIntentId
        ) {
          await stripe.refunds.create({
            payment_intent: booking.stripePaymentIntentId,
          });
          booking.paymentStatus = PaymentStatus.REFUNDED;
          booking.status = BookingStatus.CANCELLED;
          await bookingRepo.save(booking);
        }
      } else {
        const order = await orderRepo.findOne({ where: { id: dispute.targetId } });
        if (
          order &&
          order.paymentStatus === OrderPaymentStatus.PAID &&
          order.stripePaymentIntentId
        ) {
          await stripe.refunds.create({
            payment_intent: order.stripePaymentIntentId,
          });
          order.paymentStatus = OrderPaymentStatus.REFUNDED;
          order.status = OrderStatus.CANCELLED;
          await orderRepo.save(order);
        }
      }
    }

    dispute.status = status;
    dispute.resolutionNote = resolutionNote;
    const saved = await disputeRepo.save(dispute);

    return res.json(saved);
  } catch (error) {
    return res.status(500).json({ message: "Error resolving dispute", error });
  }
};
