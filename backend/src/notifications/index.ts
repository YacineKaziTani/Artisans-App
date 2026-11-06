import { In } from "typeorm";
import { AppDataSource } from "../data-source";
import { Order, OrderStatus, OrderPaymentStatus } from "../modules/orders/order.entities";
import { Booking, BookingStatus, PaymentStatus } from "../modules/booking/booking.entities";
import { Shop, ShopStatus, VerificationStatus } from "../modules/shop/shop.entities";
import { Dispute, DisputeStatus, DisputeTargetType } from "../modules/disputes/dispute.entities";
import { User, UserRole } from "../modules/users/entities/user.entities";
import { deliver, formatMoney, formatWhen } from "./deliver";

// Each notification loads what it needs by id, so callers can fire it with
// notifyInBackground() and move on. Emails go to the account's address on
// file; these are transactional messages about the user's own activity.

const orderRepo = () => AppDataSource.getRepository(Order);
const bookingRepo = () => AppDataSource.getRepository(Booking);

const ARTISAN_ORDERS = "/profile-artisan?tab=orders";
const ARTISAN_BOOKINGS = "/profile-artisan?tab=bookings";
const CLIENT_ACTIVITY = "/profile-client";

function describeLine(order: Order) {
  const variant = order.variantLabel ? ` (${order.variantLabel})` : "";
  return `${order.quantity} × ${order.product?.title ?? "item"}${variant} — ${formatMoney(order.totalAmount)}`;
}

// ── Orders ─────────────────────────────────────────────────────────────────

/** The client's card was authorized: tell the artisan there's an order to fulfil. */
export async function notifyOrdersAuthorized(orderIds: string[]) {
  if (!orderIds.length) return;
  const orders = await orderRepo().find({
    where: { id: In(orderIds) },
    relations: ["product", "client", "shop", "shop.owner"],
  });
  if (!orders.length) return;

  const { shop, client } = orders[0];
  const lines = orders.map(describeLine);
  const delivery =
    orders[0].shippingAddress
      ? `Deliver to: ${orders[0].shippingAddress}`
      : "The client will pick it up.";

  await deliver(shop.owner?.email, {
    subject: `New order from ${client.name}`,
    heading: `You have a new order on ${shop.shopName}`,
    paragraphs: [
      ...lines,
      delivery,
      "The client's card is on hold. Mark each item fulfilled once it's ready — that's when the card is charged. Holds expire after about 7 days.",
    ],
    cta: { label: "View orders", path: ARTISAN_ORDERS },
  });
  await deliver(client.email, {
    subject: `Your order with ${shop.shopName}`,
    heading: "Order placed",
    paragraphs: [
      ...lines,
      `${shop.shopName} has been notified. Your card is on hold and is only charged once the order is fulfilled — if they can't fulfil it, the hold is released.`,
    ],
    cta: { label: "View your orders", path: CLIENT_ACTIVITY },
  });
}

/** The artisan fulfilled or cancelled an order — tell the client. */
export async function notifyOrderUpdatedByShop(orderId: string) {
  const order = await orderRepo().findOne({
    where: { id: orderId },
    relations: ["product", "client", "shop"],
  });
  if (!order) return;

  if (order.status === OrderStatus.FULFILLED) {
    await deliver(order.client.email, {
      subject: `Your order from ${order.shop.shopName} is ready`,
      heading: "Order fulfilled",
      paragraphs: [
        describeLine(order),
        order.trackingInfo ? `Tracking: ${order.trackingInfo}` : "",
        "Your card has been charged for this item.",
      ].filter(Boolean),
      cta: { label: "View your orders", path: CLIENT_ACTIVITY },
    });
  } else if (order.status === OrderStatus.CANCELLED) {
    const money =
      order.paymentStatus === OrderPaymentStatus.REFUNDED
        ? "You've been refunded in full."
        : "You haven't been charged for it.";
    await deliver(order.client.email, {
      subject: `Your order from ${order.shop.shopName} was cancelled`,
      heading: "Order cancelled",
      paragraphs: [describeLine(order), `${order.shop.shopName} cancelled this order. ${money}`],
      cta: { label: "View your orders", path: CLIENT_ACTIVITY },
    });
  }
}

/** The client cancelled — tell the artisan not to fulfil it. */
export async function notifyOrderCancelledByClient(orderId: string) {
  const order = await orderRepo().findOne({
    where: { id: orderId },
    relations: ["product", "client", "shop", "shop.owner"],
  });
  if (!order) return;
  await deliver(order.shop.owner?.email, {
    subject: `Order cancelled by ${order.client.name}`,
    heading: "An order was cancelled",
    paragraphs: [describeLine(order), "The client cancelled this order — there's nothing to fulfil."],
    cta: { label: "View orders", path: ARTISAN_ORDERS },
  });
}

// ── Bookings ───────────────────────────────────────────────────────────────

/** The client's card was authorized: tell the artisan there's a request to confirm. */
export async function notifyBookingAuthorized(bookingId: string) {
  const booking = await bookingRepo().findOne({
    where: { id: bookingId },
    relations: ["service", "client", "shop", "shop.owner"],
  });
  if (!booking) return;
  const when = formatWhen(booking.scheduledAt);

  await deliver(booking.shop.owner?.email, {
    subject: `New booking request: ${booking.service.name}`,
    heading: `${booking.client.name} wants to book ${booking.service.name}`,
    paragraphs: [
      `When: ${when}`,
      booking.notes ? `Notes: ${booking.notes}` : "",
      `Price: ${formatMoney(booking.totalAmount)} — the client's card is on hold. Confirming charges it; cancelling releases the hold. Holds expire after about 7 days.`,
    ].filter(Boolean),
    cta: { label: "Review the booking", path: ARTISAN_BOOKINGS },
  });
  await deliver(booking.client.email, {
    subject: `Booking requested with ${booking.shop.shopName}`,
    heading: "Booking requested",
    paragraphs: [
      `${booking.service.name} on ${when}.`,
      `${booking.shop.shopName} has been notified and will confirm it. Your card is only charged once they do.`,
    ],
    cta: { label: "View your bookings", path: CLIENT_ACTIVITY },
  });
}

/** The artisan confirmed, completed or cancelled — tell the client. */
export async function notifyBookingUpdatedByShop(bookingId: string) {
  const booking = await bookingRepo().findOne({
    where: { id: bookingId },
    relations: ["service", "client", "shop"],
  });
  if (!booking) return;
  const what = `${booking.service.name} on ${formatWhen(booking.scheduledAt)}`;

  const content =
    booking.status === BookingStatus.CONFIRMED
      ? {
          subject: `Booking confirmed: ${booking.service.name}`,
          heading: "Your booking is confirmed",
          paragraphs: [`${booking.shop.shopName} confirmed ${what}. Your card has been charged.`],
        }
      : booking.status === BookingStatus.CANCELLED
        ? {
            subject: `Booking cancelled: ${booking.service.name}`,
            heading: "Your booking was cancelled",
            paragraphs: [
              `${booking.shop.shopName} cancelled ${what}.`,
              booking.paymentStatus === PaymentStatus.REFUNDED
                ? "You've been refunded in full."
                : "You haven't been charged.",
            ],
          }
        : booking.status === BookingStatus.COMPLETED
          ? {
              subject: `How was ${booking.service.name}?`,
              heading: "Thanks for booking",
              paragraphs: [
                `${booking.shop.shopName} marked ${what} as completed. You can now leave them a review.`,
              ],
            }
          : null;
  if (!content) return;

  await deliver(booking.client.email, {
    ...content,
    cta:
      booking.status === BookingStatus.COMPLETED
        ? { label: "Leave a review", path: `/artisan/${booking.shop.id}` }
        : { label: "View your bookings", path: CLIENT_ACTIVITY },
  });
}

/** The client cancelled — tell the artisan the slot is free. */
export async function notifyBookingCancelledByClient(bookingId: string) {
  const booking = await bookingRepo().findOne({
    where: { id: bookingId },
    relations: ["service", "client", "shop", "shop.owner"],
  });
  if (!booking) return;
  await deliver(booking.shop.owner?.email, {
    subject: `Booking cancelled by ${booking.client.name}`,
    heading: "A booking was cancelled",
    paragraphs: [
      `${booking.client.name} cancelled ${booking.service.name} on ${formatWhen(booking.scheduledAt)}. The time slot is free again.`,
    ],
    cta: { label: "View bookings", path: ARTISAN_BOOKINGS },
  });
}

// ── Shops ──────────────────────────────────────────────────────────────────

export async function notifyShopStatusChanged(shopId: string) {
  const shop = await AppDataSource.getRepository(Shop).findOne({
    where: { id: shopId },
    relations: ["owner"],
  });
  if (!shop) return;

  if (shop.status === ShopStatus.ACTIVE) {
    await deliver(shop.owner?.email, {
      subject: `${shop.shopName} is live`,
      heading: "Your shop has been approved",
      paragraphs: [
        `${shop.shopName} is now visible on Artisan Market.`,
        shop.stripeOnboardingComplete
          ? "Clients can book and buy from you right away."
          : "Connect a payout account with Stripe so clients can book and buy from you.",
      ],
      cta: { label: "Go to your shop", path: "/profile-artisan" },
    });
  } else if (shop.status === ShopStatus.SUSPENDED) {
    await deliver(shop.owner?.email, {
      subject: `${shop.shopName} has been suspended`,
      heading: "Your shop has been suspended",
      paragraphs: [
        `${shop.shopName} is hidden from the marketplace and can't take new bookings or orders. Reply to this email if you believe this is a mistake.`,
      ],
    });
  }
}

export async function notifyVerificationResolved(shopId: string) {
  const shop = await AppDataSource.getRepository(Shop).findOne({
    where: { id: shopId },
    relations: ["owner"],
  });
  if (!shop) return;
  const verified = shop.verificationStatus === VerificationStatus.VERIFIED;
  await deliver(shop.owner?.email, {
    subject: verified ? `${shop.shopName} is verified` : "Your verification request",
    heading: verified ? "Your shop is verified" : "Verification not approved",
    paragraphs: verified
      ? ["Your shop now shows a verified badge to clients."]
      : [
          shop.verificationNote
            ? `Reason: ${shop.verificationNote}`
            : "Your request didn't meet the verification criteria.",
          "You can request verification again from your shop page.",
        ],
    cta: { label: "Go to your shop", path: "/profile-artisan" },
  });
}

// ── Disputes ───────────────────────────────────────────────────────────────

/** The client and the shop owner on a dispute's order/booking. */
async function disputeParties(dispute: Dispute) {
  const target =
    dispute.targetType === DisputeTargetType.BOOKING
      ? await bookingRepo().findOne({
          where: { id: dispute.targetId },
          relations: ["client", "shop", "shop.owner"],
        })
      : await orderRepo().findOne({
          where: { id: dispute.targetId },
          relations: ["client", "shop", "shop.owner"],
        });
  return target
    ? { client: target.client, owner: target.shop.owner, shopName: target.shop.shopName }
    : null;
}

export async function notifyDisputeOpened(disputeId: string) {
  const dispute = await AppDataSource.getRepository(Dispute).findOne({
    where: { id: disputeId },
    relations: ["raisedBy"],
  });
  if (!dispute) return;
  const parties = await disputeParties(dispute);

  const admins = await AppDataSource.getRepository(User).find({
    where: { role: UserRole.SUPER_ADMIN, isActive: true },
  });
  for (const admin of admins) {
    await deliver(admin.email, {
      subject: `New dispute on a ${dispute.targetType}`,
      heading: "A dispute needs review",
      paragraphs: [
        `${dispute.raisedBy.name} opened a dispute${parties ? ` about ${parties.shopName}` : ""}.`,
        `Reason: ${dispute.reason}`,
      ],
      cta: { label: "Review disputes", path: "/dashboard/disputes" },
    });
  }

  // And whoever is on the other side of it.
  const other =
    parties &&
    (parties.client.id === dispute.raisedBy.id ? parties.owner : parties.client);
  await deliver(other?.email, {
    subject: `A dispute was opened about your ${dispute.targetType}`,
    heading: "A dispute was opened",
    paragraphs: [
      `${dispute.raisedBy.name} opened a dispute about a ${dispute.targetType}${parties ? ` with ${parties.shopName}` : ""}. An admin will review it and may contact you.`,
      `Reason given: ${dispute.reason}`,
    ],
  });
}

export async function notifyDisputeResolved(disputeId: string) {
  const dispute = await AppDataSource.getRepository(Dispute).findOne({
    where: { id: disputeId },
  });
  if (!dispute) return;
  const parties = await disputeParties(dispute);
  if (!parties) return;

  const outcome =
    dispute.status === DisputeStatus.RESOLVED_REFUNDED
      ? "It was resolved with a refund to the client."
      : dispute.status === DisputeStatus.RESOLVED_DENIED
        ? "It was reviewed and no refund was issued."
        : "It has been resolved.";
  for (const person of [parties.client, parties.owner]) {
    await deliver(person?.email, {
      subject: `Dispute resolved — ${parties.shopName}`,
      heading: "Your dispute has been resolved",
      paragraphs: [
        `The dispute about a ${dispute.targetType} with ${parties.shopName}: ${outcome}`,
        dispute.resolutionNote ? `Note from our team: ${dispute.resolutionNote}` : "",
      ].filter(Boolean),
    });
  }
}
