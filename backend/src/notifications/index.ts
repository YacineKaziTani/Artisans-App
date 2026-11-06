import { In } from "typeorm";
import { AppDataSource } from "../data-source";
import { Order, OrderStatus, OrderPaymentStatus } from "../modules/orders/order.entities";
import { Booking, BookingStatus, PaymentStatus } from "../modules/booking/booking.entities";
import { Shop, ShopStatus, VerificationStatus } from "../modules/shop/shop.entities";
import { Dispute, DisputeStatus, DisputeTargetType } from "../modules/disputes/dispute.entities";
import { User, UserRole } from "../modules/users/entities/user.entities";
import { Review } from "../modules/reviews/review.entities";
import { deliver, formatMoney, formatWhen, type EmailContent } from "./deliver";
import { Notification } from "../modules/notifications/notification.entities";
import { emitToUser } from "../realtime/socket";

/**
 * Tells one person about something on their account: an in-app
 * notification (pushed live to their open tabs) and — unless they turned
 * activity emails off — the email.
 */
async function inform(
  user: Pick<User, "id" | "email"> & { emailNotifications?: boolean } | null | undefined,
  content: EmailContent,
) {
  if (!user) return;
  const saved = await AppDataSource.getRepository(Notification).save({
    user: { id: user.id } as User,
    title: content.subject.slice(0, 200),
    body: content.paragraphs[0]?.slice(0, 500) ?? null,
    link: content.cta?.path ?? null,
  });
  emitToUser(user.id, "notification", { id: saved.id, title: saved.title });
  if (user.emailNotifications === false) return;
  await deliver(user.email, content);
}

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

  await inform(shop.owner, {
    subject: `New order from ${client.name}`,
    heading: `You have a new order on ${shop.shopName}`,
    paragraphs: [
      ...lines,
      delivery,
      "The client's card is on hold. Mark each item fulfilled once it's ready — that's when the card is charged. Holds expire after about 7 days.",
    ],
    cta: { label: "View orders", path: ARTISAN_ORDERS },
  });
  await inform(client, {
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
    await inform(order.client, {
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
    await inform(order.client, {
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
  await inform(order.shop.owner, {
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
  const when = formatWhen(booking.scheduledAt, booking.shop.timezone);

  await inform(booking.shop.owner, {
    subject: `New booking request: ${booking.service.name}`,
    heading: `${booking.client.name} wants to book ${booking.service.name}`,
    paragraphs: [
      `When: ${when}`,
      booking.notes ? `Notes: ${booking.notes}` : "",
      `Price: ${formatMoney(booking.totalAmount)} — the client's card is on hold. Confirming charges it; cancelling releases the hold. Holds expire after about 7 days.`,
    ].filter(Boolean),
    cta: { label: "Review the booking", path: ARTISAN_BOOKINGS },
  });
  await inform(booking.client, {
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
  const what = `${booking.service.name} on ${formatWhen(booking.scheduledAt, booking.shop.timezone)}`;

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

  await inform(booking.client, {
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
  await inform(booking.shop.owner, {
    subject: `Booking cancelled by ${booking.client.name}`,
    heading: "A booking was cancelled",
    paragraphs: [
      `${booking.client.name} cancelled ${booking.service.name} on ${formatWhen(booking.scheduledAt, booking.shop.timezone)}. The time slot is free again.`,
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
    await inform(shop.owner, {
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
    await inform(shop.owner, {
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
  await inform(shop.owner, {
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
    await inform(admin, {
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
  await inform(other, {
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
    await inform(person, {
      subject: `Dispute resolved — ${parties.shopName}`,
      heading: "Your dispute has been resolved",
      paragraphs: [
        `The dispute about a ${dispute.targetType} with ${parties.shopName}: ${outcome}`,
        dispute.resolutionNote ? `Note from our team: ${dispute.resolutionNote}` : "",
      ].filter(Boolean),
    });
  }
}

// ── Account ────────────────────────────────────────────────────────────────

/**
 * The confirm-your-email link. Takes the raw token directly (it's never
 * stored), so it's sent from the request that created it.
 */
export async function sendEmailVerification(
  user: { email: string; name: string },
  rawToken: string,
) {
  await deliver(user.email, {
    subject: "Confirm your email address",
    heading: `Welcome to Artisan Market, ${user.name}`,
    paragraphs: [
      "Please confirm this is your email address. Until you do, you can browse and sign in, but not buy, book or message artisans.",
      "The link works once and expires in 48 hours. If you didn't create an account, you can ignore this email.",
    ],
    cta: { label: "Confirm my email", path: `/verify-email?token=${rawToken}` },
  });
}

// ── Reviews ────────────────────────────────────────────────────────────────

/** The artisan answered a client's review. */
export async function notifyReviewReplied(reviewId: string) {
  const review = await AppDataSource.getRepository(Review).findOne({
    where: { id: reviewId },
    relations: ["author", "shop"],
  });
  if (!review?.reply) return;
  await inform(review.author, {
    subject: `${review.shop.shopName} replied to your review`,
    heading: `${review.shop.shopName} replied to your review`,
    paragraphs: [`"${review.reply}"`],
    cta: { label: "See the reply", path: `/artisan/${review.shop.id}` },
  });
}
