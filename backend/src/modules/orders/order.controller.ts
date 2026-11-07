import { Request, Response } from "express";
import crypto from "crypto";
import type Stripe from "stripe";
import { EntityManager, In, IsNull, Not } from "typeorm";
import { AppDataSource } from "../../data-source";
import {
  Order,
  OrderStatus,
  OrderPaymentStatus,
  DeliveryMethod,
} from "./order.entities";
import { Shop, ShopStatus } from "../shop/shop.entities";
import { Product } from "../products/product.entities";
import { ProductVariant, VariantOption } from "../products/variant.entities";
import { User, UserRole } from "../users/entities/user.entities";
import {
  pageResult,
  parsePagination,
  queryString,
} from "../../middleware/validate.middleware";
import { fromCents, MIN_CHARGE_CENTS, toCents } from "../../lib/money";
import type { LineItemInput } from "./order.schemas";
import {
  stripe,
  shopCanAcceptPayments,
  connectChargeParams,
  connectRefundParams,
  closeUnpaidIntent,
  cancelIntentQuietly,
} from "../../config/stripe";
import { createdBeforeCheckoutTtl } from "../../config/checkout";
import {
  reserveProductStock,
  reserveVariantStock,
  restoreOrderStock,
} from "../products/stock";
import { notifyInBackground } from "../../notifications/deliver";
import {
  notifyOrderCancelledByClient,
  notifyOrdersAuthorized,
  notifyOrderUpdatedByShop,
  notifyOrderDelivered,
  notifyOrderHoldExpired,
  notifyOrderHoldExpiring,
} from "../../notifications";

// Request bodies are validated by the zod schemas in order.schemas.ts.

const orderRepo = AppDataSource.getRepository(Order);

// Nothing has been authorized on the card yet.
const UNPAID_STATES = [OrderPaymentStatus.UNPAID, OrderPaymentStatus.FAILED];
// The card is on hold or already charged — safe to fulfil.
const FULFILLABLE_STATES = [
  OrderPaymentStatus.AUTHORIZED,
  OrderPaymentStatus.PAID,
];

const CONCURRENT_UPDATE = {
  message: "This order was just updated — refresh and try again",
};

class CheckoutError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Runs a checkout transaction, turning a CheckoutError into a value. */
async function runCheckout<T>(
  work: (manager: EntityManager) => Promise<T>,
): Promise<T | CheckoutError> {
  try {
    return await AppDataSource.transaction(work);
  } catch (err) {
    if (err instanceof CheckoutError) return err;
    throw err;
  }
}

function deliveryFields(body: {
  deliveryMethod: DeliveryMethod;
  shippingAddress?: string;
}) {
  return {
    deliveryMethod: body.deliveryMethod,
    shippingAddress:
      body.deliveryMethod === DeliveryMethod.DELIVERY
        ? body.shippingAddress
        : undefined,
  };
}

/**
 * Checks the shop offers the chosen method and works out the delivery
 * charge, in cents, for an order whose items come to `itemsCents`.
 * Thrown inside the checkout transaction, so a refusal rolls back the
 * stock already reserved.
 */
function deliveryChargeCents(shop: Shop, method: DeliveryMethod, itemsCents: number) {
  if (method === DeliveryMethod.PICKUP) {
    if (shop.pickupEnabled === false) {
      throw new CheckoutError(400, "This shop doesn't offer pickup — please choose delivery.");
    }
    return 0;
  }
  if (shop.deliveryEnabled === false) {
    throw new CheckoutError(400, "This shop doesn't deliver — please choose pickup.");
  }
  if (shop.freeDeliveryOver != null && itemsCents >= toCents(shop.freeDeliveryOver)) {
    return 0;
  }
  return toCents(shop.deliveryFee);
}

function assertChargeable(totalCents: number) {
  if (totalCents < MIN_CHARGE_CENTS) {
    throw new CheckoutError(
      400,
      `The order total must be at least $${fromCents(MIN_CHARGE_CENTS).toFixed(2)}`,
    );
  }
}

/**
 * Validates one line and reserves its stock, inside the caller's
 * transaction — if a later line in the same cart fails, the whole
 * transaction (and every reservation made so far) rolls back.
 * Prices are worked out in integer cents.
 */
async function reserveLineItem(
  manager: EntityManager,
  line: LineItemInput,
  buyerId: string,
) {
  const product = await manager.findOne(Product, {
    where: { id: line.productId, archivedAt: IsNull() },
    relations: ["shop", "shop.owner"],
  });
  if (!product) {
    throw new CheckoutError(404, "This product is no longer available");
  }
  // Same rule as bookings. Buying from yourself would move money through
  // Stripe for nothing (and pay the platform fee on it).
  if (product.shop.owner?.id === buyerId) {
    throw new CheckoutError(400, "You can't buy a product from your own shop");
  }
  if (product.shop.status !== ShopStatus.ACTIVE) {
    throw new CheckoutError(400, "This shop isn't currently accepting orders.");
  }
  if (!shopCanAcceptPayments(product.shop)) {
    throw new CheckoutError(
      400,
      "This shop hasn't finished setting up payouts yet and can't accept orders.",
    );
  }

  if (!line.variantId) {
    // A product with options is only sold as one of its variants — that's
    // where its price and stock live. Leaving variantId off used to buy it
    // at basePrice and skip the stock check entirely.
    const hasOptions = await manager.exists(VariantOption, {
      where: { product: { id: line.productId } },
    });
    if (hasOptions) {
      throw new CheckoutError(400, "Choose an option for this product first");
    }
    // Products without variants used to have unlimited stock. If the
    // artisan tracks a count, reserve from it; NULL means made to order.
    if (
      product.stockQuantity !== null &&
      product.stockQuantity !== undefined &&
      !(await reserveProductStock(manager, product.id, line.quantity))
    ) {
      const current = await manager.findOne(Product, { where: { id: product.id } });
      const left = current?.stockQuantity ?? 0;
      throw new CheckoutError(
        409,
        left < 1 ? "This product is out of stock" : `Only ${left} left of this product`,
      );
    }
    return {
      product,
      variant: null,
      unitPriceCents: toCents(product.basePrice),
      variantLabel: undefined,
    };
  }

  const variant = await manager.findOne(ProductVariant, {
    where: { id: line.variantId },
    relations: ["product", "values", "values.option"],
  });
  if (!variant || variant.product.id !== line.productId) {
    throw new CheckoutError(404, "Variant not found for this product");
  }

  if (!(await reserveVariantStock(manager, variant.id, line.quantity))) {
    const current = await manager.findOne(ProductVariant, {
      where: { id: variant.id },
    });
    const left = current?.stockQuantity ?? 0;
    throw new CheckoutError(
      409,
      left < 1
        ? "That variant is out of stock"
        : `Only ${left} left of that variant`,
    );
  }

  const unitPriceCents =
    variant.priceOverride !== undefined && variant.priceOverride !== null
      ? toCents(variant.priceOverride)
      : toCents(product.basePrice) +
        variant.values.reduce((sum, v) => sum + toCents(v.priceModifier), 0);

  const variantLabel = variant.values
    .map((v) => `${v.option.name}: ${v.value}`)
    .join(", ");

  return { product, variant, unitPriceCents, variantLabel };
}

/**
 * Deletes an order that was never paid for and gives its stock back.
 *
 * The delete only matches a still-pending, never-authorized row, so when the
 * expiry sweep, the client backing out and the payment_intent.canceled
 * webhook race over the same order, exactly one of them restores the stock.
 *
 * Unpaid checkouts are deleted rather than kept as "cancelled": nothing was
 * charged, Stripe keeps the cancelled PaymentIntent (with the order id in its
 * metadata) as the record, and abandoned carts stay out of both the client's
 * and the artisan's order lists.
 */
async function discardUnpaidOrder(order: Order) {
  const result = await orderRepo.delete({
    id: order.id,
    status: OrderStatus.PENDING,
    paymentStatus: In(UNPAID_STATES),
  });
  if ((result.affected ?? 0) === 0) return false;
  await restoreOrderStock(order);
  return true;
}

/**
 * Atomically moves an order to CANCELLED, but only from one of `from`.
 *
 * Every cancel path claims the row *first* and only then talks to Stripe and
 * restores stock, so two paths racing over one order (the artisan cancelling
 * while the payment_intent.canceled webhook lands, say) can't both put the
 * stock back.
 */
export async function claimOrderCancellation(
  orderId: string,
  from: OrderStatus[],
) {
  const result = await orderRepo.update(
    { id: orderId, status: In(from) },
    { status: OrderStatus.CANCELLED },
  );
  return (result.affected ?? 0) > 0;
}

/** Undoes a claim when the Stripe call that followed it failed. */
export async function releaseOrderCancellation(
  orderId: string,
  previous: OrderStatus,
) {
  await orderRepo.update(
    { id: orderId, status: OrderStatus.CANCELLED },
    { status: previous },
  );
}

/**
 * Creates the PaymentIntent for freshly reserved order rows. If Stripe fails
 * there's nothing the client could pay, so the rows are discarded and their
 * stock released rather than left reserved.
 */
async function openPaymentIntent(
  orders: Order[],
  shop: Shop,
  metadata: Record<string, string>,
  receiptEmail?: string,
) {
  const amountInCents = orders.reduce((sum, o) => sum + toCents(o.totalAmount), 0);

  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      capture_method: "manual",
      metadata,
      // Stripe emails the client a receipt once the card is actually charged.
      ...(receiptEmail ? { receipt_email: receiptEmail } : {}),
      automatic_payment_methods: { enabled: true },
      ...connectChargeParams(shop, amountInCents),
    });
  } catch (err) {
    await Promise.all(orders.map((o) => discardUnpaidOrder(o)));
    throw err;
  }

  await orderRepo.update(
    { id: In(orders.map((o) => o.id)) },
    { stripePaymentIntentId: intent.id },
  );
  for (const o of orders) o.stripePaymentIntentId = intent.id;
  return intent.client_secret;
}

export const createOrder = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const line = req.body as LineItemInput;
    const delivery = deliveryFields(req.body);

    const reserved = await runCheckout(async (manager) => {
      const { product, variant, unitPriceCents, variantLabel } =
        await reserveLineItem(manager, line, userId);
      const itemsCents = unitPriceCents * line.quantity;
      const feeCents = deliveryChargeCents(product.shop, delivery.deliveryMethod, itemsCents);
      const totalCents = itemsCents + feeCents;
      assertChargeable(totalCents);

      const order = await manager.save(
        manager.create(Order, {
          client: { id: userId } as User,
          shop: product.shop,
          product,
          productId: product.id,
          variant: variant ?? undefined,
          variantLabel,
          quantity: line.quantity,
          totalAmount: fromCents(totalCents),
          deliveryFee: fromCents(feeCents),
          status: OrderStatus.PENDING,
          paymentStatus: OrderPaymentStatus.UNPAID,
          ...delivery,
        }),
      );
      return { order, shop: product.shop };
    });
    if (reserved instanceof CheckoutError) {
      return res.status(reserved.status).json({ message: reserved.message });
    }

    const { order, shop } = reserved;
    const clientSecret = await openPaymentIntent(
      [order],
      shop,
      { type: "order", orderId: order.id },
      req.user!.email,
    );

    return res.status(201).json({ order, clientSecret });
  } catch (error) {
    console.error("createOrder failed:", error);
    return res.status(500).json({ message: "Error creating order" });
  }
};

export const createCartCheckout = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const lines = req.body.items as LineItemInput[];
    const delivery = deliveryFields(req.body);
    const checkoutGroupId = crypto.randomUUID();

    const reserved = await runCheckout(async (manager) => {
      const orders: Order[] = [];
      let shop: Shop | undefined;
      let totalCents = 0;

      for (const line of lines) {
        const { product, variant, unitPriceCents, variantLabel } =
          await reserveLineItem(manager, line, userId);
        const lineCents = unitPriceCents * line.quantity;
        totalCents += lineCents;

        if (!shop) {
          shop = product.shop;
        } else if (product.shop.id !== shop.id) {
          throw new CheckoutError(
            400,
            "All items in one checkout must be from the same shop — check out separately for items from different shops.",
          );
        }

        orders.push(
          await manager.save(
            manager.create(Order, {
              client: { id: userId } as User,
              shop: product.shop,
              product,
              productId: product.id,
              variant: variant ?? undefined,
              variantLabel,
              quantity: line.quantity,
              totalAmount: fromCents(lineCents),
              status: OrderStatus.PENDING,
              paymentStatus: OrderPaymentStatus.UNPAID,
              checkoutGroupId,
              ...delivery,
            }),
          ),
        );
      }

      // Delivery is charged once per checkout, on the first line: its
      // totalAmount includes the fee, so per-line capture and refunds need
      // no special case.
      const feeCents = deliveryChargeCents(shop!, delivery.deliveryMethod, totalCents);
      if (feeCents > 0) {
        const first = orders[0];
        first.totalAmount = fromCents(toCents(first.totalAmount) + feeCents);
        first.deliveryFee = fromCents(feeCents);
        await manager.save(first);
        totalCents += feeCents;
      }

      assertChargeable(totalCents);
      return { orders, shop: shop! };
    });
    if (reserved instanceof CheckoutError) {
      return res.status(reserved.status).json({ message: reserved.message });
    }

    const { orders, shop } = reserved;
    // Orders are found from the webhook by stripePaymentIntentId, so the
    // metadata only needs the group id (a CSV of order ids used to go past
    // Stripe's 500-character metadata limit at ~13 lines).
    const clientSecret = await openPaymentIntent(
      orders,
      shop,
      { type: "cart", checkoutGroupId },
      req.user!.email,
    );

    return res.status(201).json({ orders, clientSecret });
  } catch (error) {
    console.error("createCartCheckout failed:", error);
    return res.status(500).json({ message: "Error checking out cart" });
  }
};

/**
 * A cart checkout shares one authorization across its order rows. Once
 * every line is resolved (fulfilled or cancelled), capture just the
 * fulfilled lines' share and release the rest.
 *
 * Idempotent: once settled no line is AUTHORIZED any more, so a repeat call
 * is a no-op. (It used to require every line to be AUTHORIZED, so a single
 * line knocked to UNPAID — e.g. by a dispute — stopped the rest of the cart
 * from ever being captured.)
 */
export async function settleCheckoutGroup(groupId: string) {
  const siblings = await orderRepo.find({
    where: { checkoutGroupId: groupId },
  });
  if (siblings.some((o) => o.status === OrderStatus.PENDING)) return;

  const held = siblings.filter(
    (o) => o.paymentStatus === OrderPaymentStatus.AUTHORIZED,
  );
  const intentId = held[0]?.stripePaymentIntentId;
  if (!intentId) return;

  const fulfilled = held.filter((o) => o.status === OrderStatus.FULFILLED);
  const released = held.filter((o) => o.status !== OrderStatus.FULFILLED);
  let captureCents = fulfilled.reduce(
    (sum, o) => sum + toCents(o.totalAmount),
    0,
  );

  // The delivery fee rides on one line. If that line was cancelled but the
  // rest of the cart is still being delivered, the fee belongs with what's
  // delivered: move it onto a fulfilled line and charge it. The move is
  // conditional, so racing settlements move it once — and they all compute
  // the same capture amount from the same starting rows either way.
  if (fulfilled.length) {
    for (const line of released) {
      const feeCents = toCents(line.deliveryFee);
      if (feeCents <= 0) continue;
      const moved = await orderRepo
        .createQueryBuilder()
        .update(Order)
        .set({
          deliveryFee: 0,
          totalAmount: () => `"totalAmount" - ${fromCents(feeCents)}`,
        })
        .where("id = :id AND \"deliveryFee\" > 0", { id: line.id })
        .execute();
      if (moved.affected) {
        await AppDataSource.query(
          `UPDATE orders SET "totalAmount" = "totalAmount" + $1, "deliveryFee" = "deliveryFee" + $1 WHERE id = $2`,
          [fromCents(feeCents), fulfilled[0].id],
        );
      }
      captureCents += feeCents;
    }
  }

  // Idempotency keys make two settlements racing over the same cart (two
  // lines resolved at the same moment) safe: Stripe replays the first result.
  if (captureCents > 0) {
    await stripe.paymentIntents.capture(
      intentId,
      { amount_to_capture: captureCents },
      { idempotencyKey: `settle-capture-${intentId}-${captureCents}` },
    );
  } else {
    await stripe.paymentIntents.cancel(
      intentId,
      {},
      { idempotencyKey: `settle-cancel-${intentId}` },
    );
  }

  if (fulfilled.length) {
    await orderRepo.update(
      {
        id: In(fulfilled.map((o) => o.id)),
        paymentStatus: OrderPaymentStatus.AUTHORIZED,
      },
      { paymentStatus: OrderPaymentStatus.PAID },
    );
  }
  if (released.length) {
    await orderRepo.update(
      {
        id: In(released.map((o) => o.id)),
        paymentStatus: OrderPaymentStatus.AUTHORIZED,
      },
      { paymentStatus: OrderPaymentStatus.UNPAID },
    );
  }
}

/** settleCheckoutGroup, reporting a failure instead of throwing. */
async function trySettleCheckoutGroup(groupId: string) {
  try {
    await settleCheckoutGroup(groupId);
    return null;
  } catch (err) {
    console.error("Settling checkout group failed:", groupId, err);
    return {
      message:
        "Couldn't settle the payment for this cart — the authorization hold may have expired (holds last about 7 days).",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function refundScopeFor(order: Order) {
  return order.checkoutGroupId
    ? { amount: toCents(order.totalAmount) }
    : {};
}

const LIST_PAGE = { defaultLimit: 20, maxLimit: 100 };

/** Optional ?status= filter, ignored if it isn't a real status. */
function statusFilter(value: unknown) {
  const status = queryString(value) as OrderStatus | undefined;
  return status && Object.values(OrderStatus).includes(status) ? status : undefined;
}

export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const { page, take, skip } = parsePagination(req.query, LIST_PAGE);
    const status = statusFilter(req.query.status);
    const [orders, total] = await orderRepo.findAndCount({
      where: { client: { id: req.user!.id }, ...(status ? { status } : {}) },
      relations: ["shop", "product"],
      order: { createdAt: "DESC", id: "ASC" },
      skip,
      take,
    });
    return res.json(pageResult(orders, total, page, take));
  } catch (error) {
    console.error("getMyOrders failed:", error);
    return res.status(500).json({ message: "Error fetching orders" });
  }
};

export const getShopOrders = async (req: Request, res: Response) => {
  try {
    const shop = await AppDataSource.getRepository(Shop).findOne({
      where: { owner: { id: req.user!.id } },
    });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const { page, take, skip } = parsePagination(req.query, LIST_PAGE);
    const status = statusFilter(req.query.status);

    // An order the client never paid for isn't something the artisan can
    // act on (it's released after the checkout TTL), so it's left out.
    const [orders, total] = await orderRepo
      .createQueryBuilder("o")
      .leftJoinAndSelect("o.product", "product")
      .leftJoinAndSelect("o.client", "client")
      .where("o.shopId = :shopId", { shopId: shop.id })
      .andWhere(
        "NOT (o.status = :pending AND o.paymentStatus IN (:...unpaid))",
        { pending: OrderStatus.PENDING, unpaid: UNPAID_STATES },
      )
      .andWhere(status ? "o.status = :status" : "TRUE", { status })
      .orderBy("o.createdAt", "DESC")
      .addOrderBy("o.id", "ASC")
      .skip(skip)
      .take(take)
      .getManyAndCount();
    return res.json(pageResult(orders, total, page, take));
  } catch (error) {
    console.error("getShopOrders failed:", error);
    return res.status(500).json({ message: "Error fetching orders" });
  }
};

export const getAllOrdersAdmin = async (req: Request, res: Response) => {
  try {
    const { page, take, skip } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 200,
    });
    const status = statusFilter(req.query.status);
    const [orders, total] = await orderRepo.findAndCount({
      where: status ? { status } : {},
      // variantLabel is snapshotted on the order, so no variant joins.
      relations: ["shop", "product", "client"],
      order: { createdAt: "DESC", id: "ASC" },
      skip,
      take,
    });
    return res.json(pageResult(orders, total, page, take));
  } catch (error) {
    console.error("getAllOrdersAdmin failed:", error);
    return res.status(500).json({ message: "Error fetching orders" });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const { status, trackingInfo } = req.body as {
      status: OrderStatus;
      trackingInfo?: string;
    };

    if (!Object.values(OrderStatus).includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await orderRepo.findOne({
      where: { id },
      relations: ["shop", "shop.owner", "variant"],
    });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (
      order.shop.owner.id !== userId &&
      req.user!.role !== UserRole.SUPER_ADMIN
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const groupId = order.checkoutGroupId;
    const intentId = order.stripePaymentIntentId;
    const tracking = trackingInfo !== undefined ? { trackingInfo } : {};

    if (order.status === status) {
      // Re-sending the current status retries a cart settlement that
      // failed earlier.
      if (groupId) {
        const failure = await trySettleCheckoutGroup(groupId);
        if (failure) return res.status(409).json(failure);
      }
      return res.json(await orderRepo.findOne({ where: { id } }));
    }
    if (order.status === OrderStatus.CANCELLED) {
      return res
        .status(400)
        .json({ message: "This order is already cancelled" });
    }
    if (status === OrderStatus.PENDING) {
      return res
        .status(400)
        .json({ message: "An order can't be moved back to pending" });
    }

    if (status === OrderStatus.FULFILLED) {
      if (!FULFILLABLE_STATES.includes(order.paymentStatus)) {
        return res.status(400).json({
          message:
            order.paymentStatus === OrderPaymentStatus.FAILED
              ? "The client's card was declined — this order can't be fulfilled until they complete payment"
              : order.paymentStatus === OrderPaymentStatus.UNPAID
                ? "The client hasn't authorized payment for this order yet"
                : `This order's payment is ${order.paymentStatus.replace("_", " ")}, so it can't be fulfilled`,
        });
      }

      const claimed = await orderRepo.update(
        { id, status: OrderStatus.PENDING },
        { status: OrderStatus.FULFILLED },
      );
      if (!claimed.affected) return res.status(409).json(CONCURRENT_UPDATE);

      let paymentStatus = order.paymentStatus;
      if (
        !groupId &&
        order.paymentStatus === OrderPaymentStatus.AUTHORIZED &&
        intentId
      ) {
        try {
          await stripe.paymentIntents.capture(
            intentId,
            {},
            { idempotencyKey: `capture-${intentId}` },
          );
        } catch (err) {
          await orderRepo.update(
            { id, status: OrderStatus.FULFILLED },
            { status: OrderStatus.PENDING },
          );
          return res.status(409).json({
            message:
              "Couldn't charge the client's card — the authorization hold may have expired (holds last about 7 days). Ask the client to order again.",
            error: err instanceof Error ? err.message : err,
          });
        }
        paymentStatus = OrderPaymentStatus.PAID;
      }
      await orderRepo.update(id, { paymentStatus, ...tracking });
    }

    if (status === OrderStatus.CANCELLED) {
      const previous = order.status;
      if (!(await claimOrderCancellation(id, [previous]))) {
        return res.status(409).json(CONCURRENT_UPDATE);
      }

      let paymentStatus = order.paymentStatus;
      try {
        if (order.paymentStatus === OrderPaymentStatus.AUTHORIZED && intentId) {
          // In a cart the hold covers every line; settleCheckoutGroup
          // releases this line's share once the group is resolved.
          if (!groupId) {
            await stripe.paymentIntents.cancel(intentId);
            paymentStatus = OrderPaymentStatus.UNPAID; // hold released, never charged
          }
        } else if (order.paymentStatus === OrderPaymentStatus.PAID && intentId) {
          await stripe.refunds.create({
            payment_intent: intentId,
            ...refundScopeFor(order),
            ...connectRefundParams(!groupId),
          });
          paymentStatus = OrderPaymentStatus.REFUNDED;
        } else if (UNPAID_STATES.includes(order.paymentStatus) && !groupId) {
          await cancelIntentQuietly(intentId);
        }
      } catch (err) {
        await releaseOrderCancellation(id, previous);
        throw err;
      }

      await restoreOrderStock(order);
      await orderRepo.update(id, { paymentStatus, ...tracking });
    }

    // Reached only once the status change has gone through.
    notifyInBackground(() => notifyOrderUpdatedByShop(id));

    if (groupId) {
      const failure = await trySettleCheckoutGroup(groupId);
      if (failure) return res.status(409).json(failure);
    }

    return res.json(await orderRepo.findOne({ where: { id } }));
  } catch (error) {
    console.error("updateOrderStatus failed:", error);
    return res.status(500).json({ message: "Error updating order" });
  }
};

// Client cancels their own order. If the card was only on hold, the hold is
// released; if it was already captured, this refunds it.
export const cancelMyOrder = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const order = await orderRepo.findOne({
      where: { id },
      relations: ["client", "variant"],
    });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.client.id !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (order.status === OrderStatus.CANCELLED) {
      return res.status(400).json({ message: "Order is already cancelled" });
    }
    if (order.status === OrderStatus.FULFILLED) {
      return res
        .status(400)
        .json({ message: "Can't cancel a fulfilled order" });
    }

    const groupId = order.checkoutGroupId;
    const intentId = order.stripePaymentIntentId;

    if (!(await claimOrderCancellation(id, [OrderStatus.PENDING]))) {
      return res.status(409).json(CONCURRENT_UPDATE);
    }

    let paymentStatus = order.paymentStatus;
    try {
      if (order.paymentStatus === OrderPaymentStatus.AUTHORIZED && intentId) {
        if (!groupId) {
          await stripe.paymentIntents.cancel(intentId);
          paymentStatus = OrderPaymentStatus.UNPAID;
        }
      } else if (order.paymentStatus === OrderPaymentStatus.PAID && intentId) {
        await stripe.refunds.create({
          payment_intent: intentId,
          ...refundScopeFor(order),
          ...connectRefundParams(!groupId),
        });
        paymentStatus = OrderPaymentStatus.REFUNDED;
      } else if (UNPAID_STATES.includes(order.paymentStatus) && !groupId) {
        await cancelIntentQuietly(intentId);
      }
    } catch (err) {
      await releaseOrderCancellation(id, OrderStatus.PENDING);
      throw err;
    }

    await restoreOrderStock(order);
    await orderRepo.update(id, { paymentStatus });

    // The artisan only heard about the order once it was paid for/held, so
    // only then is there anything to tell them.
    if (!UNPAID_STATES.includes(order.paymentStatus)) {
      notifyInBackground(() => notifyOrderCancelledByClient(id));
    }

    // The client's cancellation stands even if the rest of the cart can't
    // settle yet — the artisan sees that failure when they act on it.
    if (groupId) await trySettleCheckoutGroup(groupId);

    return res.json(await orderRepo.findOne({ where: { id } }));
  } catch (error) {
    console.error("cancelMyOrder failed:", error);
    return res.status(500).json({ message: "Error cancelling order" });
  }
};

/**
 * Closes unpaid checkouts, one PaymentIntent at a time (a cart's lines share
 * one). Stripe is asked first: if the card actually went through, the
 * orders are kept and marked accordingly instead of discarded. Failures are
 * logged per intent so one bad checkout can't block the rest.
 */
async function abandonUnpaidOrders(orders: Order[]) {
  const byIntent = new Map<string, Order[]>();
  for (const order of orders) {
    const key = order.stripePaymentIntentId ?? `no-intent:${order.id}`;
    byIntent.set(key, [...(byIntent.get(key) ?? []), order]);
  }

  let discarded = 0;
  for (const [key, group] of byIntent) {
    const intentId = key.startsWith("no-intent:") ? undefined : key;
    try {
      const outcome = await closeUnpaidIntent(intentId);
      if (outcome === "authorized") {
        await handleOrderIntentAuthorized(intentId!);
      } else if (outcome === "captured") {
        await handleOrderIntentCaptured(intentId!);
      } else if (outcome === "abandoned") {
        for (const order of group) {
          if (await discardUnpaidOrder(order)) discarded++;
        }
      }
    } catch (err) {
      console.error("Couldn't close unpaid checkout", key, err);
    }
  }
  return discarded;
}

/**
 * The client backed out of the payment step (closed the Buy dialog, or
 * cancelled the cart payment). Releases the reserved stock immediately
 * instead of waiting for the expiry sweep.
 */
export const abandonMyCheckout = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { orderIds } = req.body as { orderIds: string[] };

    const orders = await orderRepo.find({
      where: {
        id: In(orderIds),
        client: { id: userId },
        status: OrderStatus.PENDING,
        paymentStatus: In(UNPAID_STATES),
      },
      relations: ["variant"],
    });

    return res.json({ discarded: await abandonUnpaidOrders(orders) });
  } catch (error) {
    console.error("abandonMyCheckout failed:", error);
    return res.status(500).json({ message: "Error cancelling checkout" });
  }
};

/** Expiry sweep: unpaid orders older than the checkout TTL. */
export async function expireStaleOrders(batchSize = 100) {
  const stale = await orderRepo.find({
    where: {
      status: OrderStatus.PENDING,
      paymentStatus: In(UNPAID_STATES),
      createdAt: createdBeforeCheckoutTtl(),
    },
    relations: ["variant"],
    order: { createdAt: "ASC" },
    take: batchSize,
  });
  return abandonUnpaidOrders(stale);
}

// ── Stripe webhook handlers ────────────────────────────────────────────────
// Orders are looked up by PaymentIntent id, which covers single orders and
// every line of a cart. Each update is conditional on the current payment
// state, so late or out-of-order events can only move an order *forward*.

export async function handleOrderIntentAuthorized(intentId: string) {
  // FAILED is included: a declined card followed by a successful retry
  // fires payment_failed and then this event on the same intent. Upgrading
  // only from UNPAID left those orders stuck at FAILED, which the old
  // fulfil check let through without ever capturing the hold.
  const newlyAuthorized = await orderRepo.find({
    where: {
      stripePaymentIntentId: intentId,
      paymentStatus: In(UNPAID_STATES),
      status: Not(OrderStatus.CANCELLED),
    },
    select: { id: true },
  });
  await orderRepo.update(
    { stripePaymentIntentId: intentId, paymentStatus: In(UNPAID_STATES) },
    { paymentStatus: OrderPaymentStatus.AUTHORIZED, authorizedAt: new Date() },
  );
  // This is the moment an order becomes real for the artisan. Webhook events
  // are de-duplicated and the update is conditional, so this sends once.
  if (newlyAuthorized.length) {
    const ids = newlyAuthorized.map((o) => o.id);
    notifyInBackground(() => notifyOrdersAuthorized(ids));
  }

  // Lines cancelled before the client finished paying had their share
  // authorized anyway — release it.
  try {
    const orders = await orderRepo.find({
      where: { stripePaymentIntentId: intentId },
    });
    const groupId = orders.find((o) => o.checkoutGroupId)?.checkoutGroupId;
    if (groupId) {
      await settleCheckoutGroup(groupId); // no-op while any line is pending
    } else if (
      orders.length > 0 &&
      orders.every((o) => o.status === OrderStatus.CANCELLED)
    ) {
      await stripe.paymentIntents.cancel(intentId);
      await orderRepo.update(
        {
          stripePaymentIntentId: intentId,
          paymentStatus: OrderPaymentStatus.AUTHORIZED,
        },
        { paymentStatus: OrderPaymentStatus.UNPAID },
      );
    }
  } catch (err) {
    console.error("Couldn't release a hold on cancelled orders:", intentId, err);
  }
}

export async function handleOrderIntentFailed(intentId: string) {
  // Only an order nobody has paid for can "fail" — a late failure event must
  // never knock an authorized order back down.
  await orderRepo.update(
    {
      stripePaymentIntentId: intentId,
      paymentStatus: OrderPaymentStatus.UNPAID,
    },
    { paymentStatus: OrderPaymentStatus.FAILED },
  );
}

export async function handleOrderIntentCaptured(intentId: string) {
  // Never overwrite REFUNDED/PARTIALLY_REFUNDED with a late capture event.
  await orderRepo.update(
    {
      stripePaymentIntentId: intentId,
      status: Not(OrderStatus.CANCELLED),
      paymentStatus: In([...UNPAID_STATES, OrderPaymentStatus.AUTHORIZED]),
    },
    { paymentStatus: OrderPaymentStatus.PAID },
  );
}

export async function handleOrderIntentCanceled(intentId: string) {
  const orders = await orderRepo.find({
    where: { stripePaymentIntentId: intentId },
    relations: ["variant"],
  });

  const expired: string[] = [];
  const uncollected: string[] = [];
  for (const order of orders) {
    const authorized = order.paymentStatus === OrderPaymentStatus.AUTHORIZED;

    if (
      order.status === OrderStatus.PENDING &&
      UNPAID_STATES.includes(order.paymentStatus)
    ) {
      await discardUnpaidOrder(order);
    } else if (order.status === OrderStatus.PENDING && authorized) {
      // The hold was released or expired (Stripe drops uncaptured holds
      // after about 7 days) before the artisan acted on the order.
      if (await claimOrderCancellation(order.id, [OrderStatus.PENDING])) {
        await restoreOrderStock(order);
        await orderRepo.update(order.id, {
          paymentStatus: OrderPaymentStatus.UNPAID,
        });
        expired.push(order.id);
      }
    } else if (order.status === OrderStatus.FULFILLED && authorized) {
      // Fulfilled, but the hold expired before the cart settled — the money
      // was never collected.
      const marked = await orderRepo.update(
        { id: order.id, paymentStatus: OrderPaymentStatus.AUTHORIZED },
        { paymentStatus: OrderPaymentStatus.FAILED },
      );
      if (marked.affected) uncollected.push(order.id);
    } else if (order.status === OrderStatus.CANCELLED && authorized) {
      await orderRepo.update(
        { id: order.id, paymentStatus: OrderPaymentStatus.AUTHORIZED },
        { paymentStatus: OrderPaymentStatus.UNPAID },
      );
    }
  }
  // Only Stripe dropping the hold lands here with live orders — our own
  // cancellations close the orders before cancelling the intent.
  if (expired.length || uncollected.length) {
    notifyInBackground(() => notifyOrderHoldExpired(expired, uncollected));
  }
}

/**
 * Reminds artisans ~2 days before a card hold lapses on an order they
 * haven't fulfilled (once per checkout). Holds last about 7 days.
 */
export async function sendOrderHoldReminders() {
  const due: { id: string; intent: string | null }[] = await AppDataSource.query(
    `UPDATE orders SET "holdReminderSentAt" = now()
      WHERE status = 'pending' AND "paymentStatus" = 'authorized' AND "holdReminderSentAt" IS NULL
        AND COALESCE("authorizedAt", "createdAt") < now() - interval '5 days'
      RETURNING id, "stripePaymentIntentId" AS intent`,
  ).then((r) => (Array.isArray(r[0]) ? r[0] : r));
  const byCheckout = new Map<string, string[]>();
  for (const row of due) {
    const key = row.intent ?? row.id;
    byCheckout.set(key, [...(byCheckout.get(key) ?? []), row.id]);
  }
  for (const ids of byCheckout.values()) notifyInBackground(() => notifyOrderHoldExpiring(ids));
  return byCheckout.size;
}

/**
 * PATCH /orders/:id/received — the client confirms a delivery order arrived.
 * (Fulfilled = shipped; this closes the loop for both sides.)
 */
export const confirmOrderReceived = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const order = await orderRepo.findOne({ where: { id }, relations: ["client"] });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.client.id !== req.user!.id) return res.status(403).json({ message: "Forbidden" });
    if (order.deliveryMethod !== DeliveryMethod.DELIVERY) {
      return res.status(400).json({ message: "Only delivery orders are confirmed as received" });
    }
    if (order.status !== OrderStatus.FULFILLED) {
      return res.status(400).json({ message: "This order hasn't been shipped yet" });
    }

    const updated = await orderRepo.update({ id, deliveredAt: IsNull() }, { deliveredAt: new Date() });
    if (updated.affected) notifyInBackground(() => notifyOrderDelivered(id));
    return res.json(await orderRepo.findOne({ where: { id } }));
  } catch (error) {
    console.error("confirmOrderReceived failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
