import { In } from "typeorm";
import { AppDataSource } from "../data-source";
import { Order, OrderStatus, OrderPaymentStatus } from "../modules/orders/order.entities";
import { Booking, BookingStatus, PaymentStatus } from "../modules/booking/booking.entities";
import { Shop, ShopStatus, VerificationStatus } from "../modules/shop/shop.entities";
import { Dispute, DisputeStatus, DisputeTargetType } from "../modules/disputes/dispute.entities";
import { User, UserRole } from "../modules/users/entities/user.entities";
import { Review } from "../modules/reviews/review.entities";
import { Product } from "../modules/products/product.entities";
import { CustomRequest } from "../modules/custom-requests/custom-request.entities";
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
  return `${order.quantity} × ${order.product?.title ?? order.title ?? "item"}${variant} — ${formatMoney(order.totalAmount)}`;
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
      booking.seats > 1 ? `Places: ${booking.seats}` : "",
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

// ── Periodic: unread messages, booking reminders, review prompts ──────────

const UNREAD_ALERT_AFTER = "15 minutes";

/**
 * Messages still unread 15 minutes after they arrived: one alert per
 * conversation (bell + email unless turned off) instead of one per message.
 * Each message is claimed before alerting, so it's only ever alerted once,
 * even with several instances running.
 */
export async function notifyUnreadMessages(limit = 500) {
  const rows: {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    clientId: string;
    ownerId: string;
    shopName: string;
  }[] = await AppDataSource.query(
    `SELECT m.id, m."conversationId", m."senderId", m.content, c."clientId", s."ownerId", s."shopName"
       FROM messages m
       JOIN conversations c ON c.id = m."conversationId"
       JOIN shops s ON s.id = c."shopId"
      WHERE m."readAt" IS NULL AND m."notifiedAt" IS NULL
        AND m."createdAt" < now() - interval '${UNREAD_ALERT_AFTER}'
      ORDER BY m."createdAt" ASC
      LIMIT $1`,
    [limit],
  );

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const recipientId = row.senderId === row.clientId ? row.ownerId : row.clientId;
    if (!recipientId || recipientId === row.senderId) continue;
    const key = `${row.conversationId}:${recipientId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  let alerted = 0;
  const users = AppDataSource.getRepository(User);
  for (const [key, messages] of groups) {
    const [conversationId, recipientId] = key.split(":");
    const claimed: { id: string }[] = await AppDataSource.query(
      `UPDATE messages SET "notifiedAt" = now() WHERE id = ANY($1) AND "notifiedAt" IS NULL RETURNING id`,
      [messages.map((m) => m.id)],
    ).then((r) => (Array.isArray(r[0]) ? r[0] : r));
    if (!claimed.length) continue;

    const first = messages[0];
    const fromShop = first.senderId === first.ownerId;
    const sender = fromShop ? null : await users.findOne({ where: { id: first.senderId } });
    const senderName = fromShop ? first.shopName : (sender?.name ?? "A client");
    const recipient = await users.findOne({ where: { id: recipientId } });
    const text = first.content.trim() || "(Sent a photo)";
    const snippet = text.length > 200 ? `${text.slice(0, 199)}…` : text;
    await inform(recipient, {
      subject: `New message from ${senderName}`,
      heading: `${senderName} sent you a message`,
      paragraphs: [
        `"${snippet}"${claimed.length > 1 ? ` — and ${claimed.length - 1} more` : ""}`,
      ],
      cta: { label: "Reply", path: `/messages/${conversationId}` },
    });
    alerted++;
  }
  return alerted;
}

/** The day before a confirmed appointment — to the client and the artisan. */
export async function notifyBookingReminder(bookingId: string) {
  const booking = await bookingRepo().findOne({
    where: { id: bookingId },
    relations: ["service", "client", "shop", "shop.owner"],
  });
  if (!booking) return;
  const when = formatWhen(booking.scheduledAt, booking.shop.timezone);
  await inform(booking.client, {
    subject: `Reminder: ${booking.service.name} tomorrow`,
    heading: `See you soon at ${booking.shop.shopName}`,
    paragraphs: [
      `Your booking for ${booking.service.name} is on ${when}.`,
      booking.shop.address ? `Address: ${booking.shop.address}${booking.shop.city ? `, ${booking.shop.city}` : ""}` : "",
    ].filter(Boolean),
    cta: { label: "View booking", path: CLIENT_ACTIVITY },
  });
  await inform(booking.shop.owner, {
    subject: `Tomorrow: ${booking.client.name} — ${booking.service.name}`,
    heading: "Appointment tomorrow",
    paragraphs: [`${booking.client.name} booked ${booking.service.name} on ${when}.`],
    cta: { label: "View bookings", path: ARTISAN_BOOKINGS },
  });
}

/** An appointment was completed — invite the client to review. */
export async function notifyBookingCompleted(bookingId: string) {
  const booking = await bookingRepo().findOne({
    where: { id: bookingId },
    relations: ["service", "client", "shop"],
  });
  if (!booking) return;
  await inform(booking.client, {
    subject: `How was ${booking.service.name}?`,
    heading: `How was your visit to ${booking.shop.shopName}?`,
    paragraphs: ["A short review helps other clients — and the artisan."],
    cta: { label: "Leave a review", path: `/artisan/${booking.shop.id}` },
  });
}

/** The client confirmed a delivery arrived — tell the artisan. */
export async function notifyOrderDelivered(orderId: string) {
  const order = await orderRepo().findOne({
    where: { id: orderId },
    relations: ["product", "client", "shop", "shop.owner"],
  });
  if (!order) return;
  await inform(order.shop.owner, {
    subject: `Delivered: ${order.product?.title ?? order.title ?? "an order"}`,
    heading: `${order.client.name} received their order`,
    paragraphs: [describeLine(order)],
    cta: { label: "View orders", path: ARTISAN_ORDERS },
  });
}

// ── Card holds (they lapse after about 7 days) ─────────────────────────────

/** Card holds last about 7 days from authorization. */
export const HOLD_DAYS = 7;

function holdDeadline(heldSince: Date | string) {
  return new Date(new Date(heldSince).getTime() + HOLD_DAYS * 24 * 60 * 60 * 1000);
}

const formatDay = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone }).format(date);

/** ~2 days before an order's hold lapses — the artisan still hasn't fulfilled it. */
export async function notifyOrderHoldExpiring(orderIds: string[]) {
  if (!orderIds.length) return;
  const orders = await orderRepo().find({
    where: { id: In(orderIds) },
    relations: ["product", "client", "shop", "shop.owner"],
  });
  if (!orders.length) return;
  const { shop, client } = orders[0];
  const deadline = holdDeadline(orders[0].authorizedAt ?? orders[0].createdAt);
  const inCart = Boolean(orders[0].checkoutGroupId);
  await inform(shop.owner, {
    subject: `Action needed: ${client.name}'s order expires soon`,
    heading: "Fulfil this order before the card hold runs out",
    paragraphs: [
      ...orders.map(describeLine),
      `The client's card is only held until about ${formatDay(deadline, shop.timezone || "UTC")}. After that the hold lapses, the order is cancelled and you won't be paid.`,
      inCart
        ? "This was one checkout: the card is charged once every item in it is fulfilled or cancelled — so resolve them all."
        : "Mark it fulfilled to charge the card, or cancel it if you can't make it.",
    ],
    cta: { label: "Open orders", path: ARTISAN_ORDERS },
  });
}

/** ~2 days before a booking's hold lapses — still not confirmed. */
export async function notifyBookingHoldExpiring(bookingId: string) {
  const booking = await bookingRepo().findOne({
    where: { id: bookingId },
    relations: ["service", "client", "shop", "shop.owner"],
  });
  if (!booking) return;
  const deadline = holdDeadline(booking.authorizedAt ?? booking.createdAt);
  await inform(booking.shop.owner, {
    subject: `Action needed: confirm ${booking.client.name}'s booking`,
    heading: "Confirm this booking before the card hold runs out",
    paragraphs: [
      `${booking.client.name} asked for ${booking.service.name} on ${formatWhen(booking.scheduledAt, booking.shop.timezone)}.`,
      `The card is only held until about ${formatDay(deadline, booking.shop.timezone || "UTC")}. Confirm it to charge the card, or decline it — otherwise it's cancelled automatically.`,
    ],
    cta: { label: "Open bookings", path: ARTISAN_BOOKINGS },
  });
}

/**
 * The hold lapsed before the artisan acted: the order was cancelled. Tells
 * the client (not charged) and the artisan (sale lost). `collected` lines
 * were fulfilled but the money couldn't be collected — the artisan is told
 * that separately, since they may have shipped already.
 */
export async function notifyOrderHoldExpired(cancelledIds: string[], uncollectedIds: string[]) {
  const ids = [...cancelledIds, ...uncollectedIds];
  if (!ids.length) return;
  const orders = await orderRepo().find({
    where: { id: In(ids) },
    relations: ["product", "client", "shop", "shop.owner"],
  });
  if (!orders.length) return;
  const { shop, client } = orders[0];
  const cancelled = orders.filter((o) => cancelledIds.includes(o.id));
  const uncollected = orders.filter((o) => uncollectedIds.includes(o.id));

  if (cancelled.length) {
    await inform(client, {
      subject: `Your order with ${shop.shopName} was cancelled`,
      heading: "Your order was cancelled — you weren't charged",
      paragraphs: [
        ...cancelled.map(describeLine),
        `${shop.shopName} didn't fulfil it in time, so the hold on your card was released. Nothing was charged. You're welcome to order again.`,
      ],
      cta: { label: "Visit the shop", path: `/artisan/${shop.id}` },
    });
  }
  await inform(shop.owner, {
    subject: uncollected.length ? "Payment couldn't be collected" : `Order expired: ${client.name}`,
    heading: uncollected.length ? "The card hold lapsed before payment was collected" : "An order expired",
    paragraphs: [
      ...cancelled.map((o) => `Cancelled (not fulfilled in time): ${describeLine(o)}`),
      ...uncollected.map((o) => `Fulfilled but not paid: ${describeLine(o)}`),
      uncollected.length
        ? "The card is only charged once every item in a checkout is resolved, and the hold ran out first. Contact the client or our team about the unpaid items."
        : "Card holds last about 7 days. Fulfil or cancel orders sooner so you don't lose sales.",
    ],
    cta: { label: "Open orders", path: ARTISAN_ORDERS },
  });
}

/** The hold lapsed before the booking was confirmed: it was cancelled. */
export async function notifyBookingHoldExpired(bookingId: string) {
  const booking = await bookingRepo().findOne({
    where: { id: bookingId },
    relations: ["service", "client", "shop", "shop.owner"],
  });
  if (!booking) return;
  const what = `${booking.service.name} on ${formatWhen(booking.scheduledAt, booking.shop.timezone)}`;
  await inform(booking.client, {
    subject: `Your booking with ${booking.shop.shopName} was cancelled`,
    heading: "Your booking request expired — you weren't charged",
    paragraphs: [`${booking.shop.shopName} didn't confirm ${what} in time, so the hold on your card was released.`],
    cta: { label: "Book another time", path: `/artisan/${booking.shop.id}` },
  });
  await inform(booking.shop.owner, {
    subject: `Booking expired: ${booking.client.name}`,
    heading: "A booking request expired",
    paragraphs: [`${booking.client.name}'s request for ${what} wasn't confirmed within about 7 days, so it was cancelled.`],
    cta: { label: "Open bookings", path: ARTISAN_BOOKINGS },
  });
}

// ── Followers, stock, custom orders ────────────────────────────────────────

const FOLLOWER_ALERT_GAP = "6 hours";

/**
 * A followed shop listed something new: tell the people who follow it.
 * At most one alert per shop every few hours, however many products the
 * artisan adds in a sitting (the shop row is claimed first, so concurrent
 * uploads can't both send).
 */
export async function notifyFollowersOfNewProduct(productId: string) {
  const product = await AppDataSource.getRepository(Product).findOne({
    where: { id: productId },
    relations: ["shop", "shop.owner"],
  });
  if (!product || product.shop.status !== ShopStatus.ACTIVE) return;
  const claimed: unknown[] = await AppDataSource.query(
    `UPDATE shops SET "followersNotifiedAt" = now()
      WHERE id = $1 AND ("followersNotifiedAt" IS NULL OR "followersNotifiedAt" < now() - interval '${FOLLOWER_ALERT_GAP}')
      RETURNING id`,
    [product.shop.id],
  ).then((r) => (Array.isArray(r[0]) ? r[0] : r));
  if (!claimed.length) return;

  const followers: { id: string; email: string; emailNotifications: boolean }[] = await AppDataSource.query(
    `SELECT u.id, u.email, u."emailNotifications"
       FROM favorites f JOIN users u ON u.id = f."userId"
      WHERE f."targetType" = 'shop' AND f."targetId" = $1
        AND u."isActive" = true AND u."deletedAt" IS NULL AND u.id <> $2`,
    [product.shop.id, product.shop.owner?.id ?? null],
  );
  for (const follower of followers) {
    await inform(follower, {
      subject: `New from ${product.shop.shopName}: ${product.title}`,
      heading: `${product.shop.shopName} just listed something new`,
      paragraphs: [
        `${product.title} — ${formatMoney(product.basePrice)}`,
        "You're getting this because you follow this shop. Unfollow from the shop page any time.",
      ],
      cta: { label: "Take a look", path: `/product/${product.id}` },
    });
  }
}

/** Products whose stock just dropped to the shop's alert level or below. */
export async function notifyLowStock(items: { productId: string; title: string; left: number }[], shopId: string) {
  if (!items.length) return;
  const shop = await AppDataSource.getRepository(Shop).findOne({ where: { id: shopId }, relations: ["owner"] });
  if (!shop) return;
  await inform(shop.owner, {
    subject: items.length === 1 ? `Low stock: ${items[0].title}` : `${items.length} products are running low`,
    heading: "Time to restock",
    paragraphs: [
      ...items.map((i) => (i.left === 0 ? `${i.title} — sold out` : `${i.title} — only ${i.left} left`)),
      "Update the stock in your shop when you've made more. You can change when we warn you in your shop settings.",
    ],
    cta: { label: "Manage products", path: "/profile-artisan?tab=products" },
  });
}

const ARTISAN_REQUESTS = "/profile-artisan?tab=requests";
const CLIENT_REQUESTS = "/profile-client?tab=requests";

async function loadRequest(id: string) {
  return AppDataSource.getRepository(CustomRequest).findOne({
    where: { id },
    relations: ["client", "shop", "shop.owner"],
  });
}

const excerpt = (text: string) => (text.length > 140 ? `${text.slice(0, 137)}…` : text);

export async function notifyCustomRequestCreated(requestId: string) {
  const request = await loadRequest(requestId);
  if (!request) return;
  await inform(request.shop.owner, {
    subject: `Custom request from ${request.client.name}`,
    heading: "Someone would like a custom piece",
    paragraphs: [
      `"${excerpt(request.description)}"`,
      [
        request.budget != null ? `Budget: ${formatMoney(request.budget)}` : "",
        request.neededBy ? `Needed by ${request.neededBy}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      "Send a quote with your price and when it'll be ready — or decline if it isn't for you.",
    ].filter(Boolean),
    cta: { label: "Reply with a quote", path: ARTISAN_REQUESTS },
  });
}

export async function notifyCustomRequestQuoted(requestId: string) {
  const request = await loadRequest(requestId);
  if (!request || request.quotePrice == null) return;
  await inform(request.client, {
    subject: `${request.shop.shopName} sent you a quote`,
    heading: `Your quote: ${formatMoney(request.quotePrice)}`,
    paragraphs: [
      `For: "${excerpt(request.description)}"`,
      request.quoteReadyBy ? `Ready by ${request.quoteReadyBy}.` : "",
      request.quoteNote ? `${request.shop.shopName}: "${request.quoteNote}"` : "",
      "Accept it to place the order — your card is only held until the piece is ready.",
    ].filter(Boolean),
    cta: { label: "See the quote", path: CLIENT_REQUESTS },
  });
}

export async function notifyCustomRequestDeclined(requestId: string) {
  const request = await loadRequest(requestId);
  if (!request) return;
  await inform(request.client, {
    subject: `${request.shop.shopName} can't take on your request`,
    heading: "Your custom request was declined",
    paragraphs: [
      `For: "${excerpt(request.description)}"`,
      request.quoteNote ? `${request.shop.shopName}: "${request.quoteNote}"` : "",
      "Other makers in the same craft may be able to help.",
    ].filter(Boolean),
    cta: { label: "Find another artisan", path: "/categories" },
  });
}

export async function notifyCustomRequestCancelled(requestId: string) {
  const request = await loadRequest(requestId);
  if (!request) return;
  await inform(request.shop.owner, {
    subject: `${request.client.name} withdrew a custom request`,
    heading: "A custom request was withdrawn",
    paragraphs: [`"${excerpt(request.description)}"`, "There's nothing more to do for it."],
    cta: { label: "Open requests", path: ARTISAN_REQUESTS },
  });
}
