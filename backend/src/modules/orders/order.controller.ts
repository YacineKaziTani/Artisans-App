import { Request, Response } from "express";
import crypto from "crypto";
import { AppDataSource } from "../../data-source";
import { Order, OrderStatus, OrderPaymentStatus, DeliveryMethod } from "./order.entities";
import { Shop } from "../shop/shop.entities";
import { Product } from "../products/product.entities";
import { ProductVariant } from "../products/variant.entities";
import { User } from "../users/entities/user.entities";
import { UserRole } from "../users/entities/user.entities";
import { stripe } from "../../config/stripe";

const orderRepo = AppDataSource.getRepository(Order);
const shopRepo = AppDataSource.getRepository(Shop);
const productRepo = AppDataSource.getRepository(Product);
const variantRepo = AppDataSource.getRepository(ProductVariant);

function parseDelivery(body: {
  deliveryMethod?: string;
  shippingAddress?: string;
}) {
  const deliveryMethod =
    body.deliveryMethod === DeliveryMethod.DELIVERY
      ? DeliveryMethod.DELIVERY
      : DeliveryMethod.PICKUP;
  const shippingAddress =
    deliveryMethod === DeliveryMethod.DELIVERY ? body.shippingAddress : undefined;
  return { deliveryMethod, shippingAddress };
}

// Resolves what a line item actually costs and, if a variant was chosen,
// reserves its stock immediately (decremented at order time, restored on
// cancellation) — this prevents overselling a specific size/color between
// when a client starts checkout and when they finish paying.
async function resolveLineItem(productId: string, variantId: string | undefined) {
  const product = await productRepo.findOne({
    where: { id: productId },
    relations: ["shop"],
  });
  if (!product) return { error: "Product not found" as const };

  if (!variantId) {
    return { product, variant: null, unitPrice: Number(product.basePrice), variantLabel: undefined };
  }

  const variant = await variantRepo.findOne({
    where: { id: variantId },
    relations: ["product", "values", "values.option"],
  });
  if (!variant || variant.product.id !== productId) {
    return { error: "Variant not found for this product" as const };
  }
  if (variant.stockQuantity < 1) {
    return { error: "That variant is out of stock" as const };
  }

  const unitPrice =
    variant.priceOverride !== undefined && variant.priceOverride !== null
      ? Number(variant.priceOverride)
      : Number(product.basePrice) +
        variant.values.reduce((sum, v) => sum + Number(v.priceModifier), 0);

  const variantLabel = variant.values
    .map((v) => `${v.option.name}: ${v.value}`)
    .join(", ");

  // Reserve stock now — decremented immediately rather than only on
  // fulfillment, since payment authorization can happen well before the
  // artisan actually fulfills.
  variant.stockQuantity -= 1;
  await variantRepo.save(variant);

  return { product, variant, unitPrice, variantLabel };
}

export async function restoreVariantStock(variantId?: string) {
  if (!variantId) return;
  const variant = await variantRepo.findOne({ where: { id: variantId } });
  if (variant) {
    variant.stockQuantity += 1;
    await variantRepo.save(variant);
  }
}

// Client orders a product and gets back a Stripe PaymentIntent client secret.
export const createOrder = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { productId, variantId, quantity = 1, deliveryMethod, shippingAddress } = req.body;

    if (!productId || quantity < 1) {
      return res
        .status(400)
        .json({ message: "productId and a valid quantity are required" });
    }

    const delivery = parseDelivery({ deliveryMethod, shippingAddress });
    if (delivery.deliveryMethod === DeliveryMethod.DELIVERY && !delivery.shippingAddress?.trim()) {
      return res
        .status(400)
        .json({ message: "shippingAddress is required for delivery orders" });
    }

    const resolved = await resolveLineItem(productId, variantId);
    if ("error" in resolved) {
      return res.status(404).json({ message: resolved.error });
    }
    const { product, variant, unitPrice, variantLabel } = resolved;

    const totalAmount = unitPrice * Number(quantity);

    const order = orderRepo.create({
      client: { id: userId } as User,
      shop: product.shop,
      product,
      variant: variant ?? undefined,
      variantLabel,
      quantity,
      totalAmount,
      status: OrderStatus.PENDING,
      paymentStatus: OrderPaymentStatus.UNPAID,
      ...delivery,
    });
    const saved = await orderRepo.save(order);

    const amountInCents = Math.round(totalAmount * 100);
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        capture_method: "manual",
        metadata: { type: "order", orderId: saved.id },
        automatic_payment_methods: { enabled: true },
      });
    } catch (err) {
      // Payment setup failed — release the stock we just reserved.
      await restoreVariantStock(variant?.id);
      throw err;
    }

    saved.stripePaymentIntentId = paymentIntent.id;
    await orderRepo.save(saved);

    return res.status(201).json({
      order: saved,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error creating order", error });
  }
};

// Client checks out a cart of multiple products (possibly from different
// shops) in a single payment. Creates one Order row per line item — so each
// shop still only sees/fulfills its own orders — but all rows share a
// checkoutGroupId and a single Stripe PaymentIntent/refund.
export const createCartCheckout = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const items = req.body.items as {
      productId: string;
      variantId?: string;
      quantity: number;
    }[];
    const { deliveryMethod, shippingAddress } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "items must be a non-empty array" });
    }
    if (items.some((i) => !i.productId || !i.quantity || i.quantity < 1)) {
      return res
        .status(400)
        .json({ message: "Each item needs a productId and a valid quantity" });
    }

    const delivery = parseDelivery({ deliveryMethod, shippingAddress });
    if (delivery.deliveryMethod === DeliveryMethod.DELIVERY && !delivery.shippingAddress?.trim()) {
      return res
        .status(400)
        .json({ message: "shippingAddress is required for delivery orders" });
    }

    const checkoutGroupId = crypto.randomUUID();
    let totalAmountCents = 0;
    const createdOrders: Order[] = [];

    try {
      for (const item of items) {
        const resolved = await resolveLineItem(item.productId, item.variantId);
        if ("error" in resolved) {
          throw new Error(resolved.error);
        }
        const { product, variant, unitPrice, variantLabel } = resolved;
        const lineTotal = unitPrice * item.quantity;
        totalAmountCents += Math.round(lineTotal * 100);

        const order = orderRepo.create({
          client: { id: userId } as User,
          shop: product.shop,
          product,
          variant: variant ?? undefined,
          variantLabel,
          quantity: item.quantity,
          totalAmount: lineTotal,
          status: OrderStatus.PENDING,
          paymentStatus: OrderPaymentStatus.UNPAID,
          checkoutGroupId,
          ...delivery,
        });
        createdOrders.push(await orderRepo.save(order));
      }
    } catch (err) {
      // Roll back stock reservations for whatever we'd already committed.
      await Promise.all(createdOrders.map((o) => restoreVariantStock(o.variant?.id)));
      const message = err instanceof Error ? err.message : "Error checking out cart";
      return res.status(404).json({ message });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmountCents,
      currency: "usd",
      capture_method: "manual",
      metadata: {
        type: "cart",
        orderIds: createdOrders.map((o) => o.id).join(","),
      },
      automatic_payment_methods: { enabled: true },
    });

    await Promise.all(
      createdOrders.map((o) => {
        o.stripePaymentIntentId = paymentIntent.id;
        return orderRepo.save(o);
      }),
    );

    return res.status(201).json({
      orders: createdOrders,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error checking out cart", error });
  }
};

export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const orders = await orderRepo.find({
      where: { client: { id: userId } },
      relations: ["shop", "product", "variant", "variant.values", "variant.values.option"],
      order: { createdAt: "DESC" },
    });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching orders", error });
  }
};

export const getShopOrders = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const shop = await shopRepo.findOne({ where: { owner: { id: userId } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const orders = await orderRepo.find({
      where: { shop: { id: shop.id } },
      relations: ["product", "client", "variant", "variant.values", "variant.values.option"],
      order: { createdAt: "DESC" },
    });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching orders", error });
  }
};

export const getAllOrdersAdmin = async (req: Request, res: Response) => {
  try {
    const orders = await orderRepo.find({
      relations: ["shop", "product", "client", "variant", "variant.values", "variant.values.option"],
      order: { createdAt: "DESC" },
    });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching orders", error });
  }
};

// Artisan fulfills or cancels an order on their own shop. Fulfilling an
// authorized-but-uncaptured order captures the payment (first time the
// client is actually charged). Cancelling an authorized order releases the
// hold instead. Cancelling an already-captured (paid) order refunds it.
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

    if (status === OrderStatus.FULFILLED) {
      if (order.paymentStatus === OrderPaymentStatus.AUTHORIZED && order.stripePaymentIntentId) {
        try {
          await stripe.paymentIntents.capture(order.stripePaymentIntentId);
        } catch (err) {
          return res.status(409).json({
            message:
              "Couldn't charge the client's card — the authorization hold may have expired (holds last about 7 days). Ask the client to order again.",
            error: err instanceof Error ? err.message : err,
          });
        }
        order.paymentStatus = OrderPaymentStatus.PAID;
      } else if (order.paymentStatus === OrderPaymentStatus.UNPAID) {
        return res.status(400).json({
          message: "The client hasn't authorized payment for this order yet",
        });
      }
    }

    if (status === OrderStatus.CANCELLED) {
      if (order.paymentStatus === OrderPaymentStatus.AUTHORIZED && order.stripePaymentIntentId) {
        await stripe.paymentIntents.cancel(order.stripePaymentIntentId);
        order.paymentStatus = OrderPaymentStatus.UNPAID; // hold released, client was never charged
      } else if (
        order.paymentStatus === OrderPaymentStatus.PAID &&
        order.stripePaymentIntentId
      ) {
        await stripe.refunds.create({
          payment_intent: order.stripePaymentIntentId,
        });
        order.paymentStatus = OrderPaymentStatus.REFUNDED;
      }
      await restoreVariantStock(order.variant?.id);
    }

    if (trackingInfo !== undefined) order.trackingInfo = trackingInfo;
    order.status = status;
    const saved = await orderRepo.save(order);
    return res.json(saved);
  } catch (error) {
    return res.status(500).json({ message: "Error updating order", error });
  }
};

// Client cancels their own order. If payment was only authorized (not yet
// captured by the artisan), the hold is released and nothing is charged. If
// it was already captured, this refunds it.
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

    if (order.paymentStatus === OrderPaymentStatus.AUTHORIZED && order.stripePaymentIntentId) {
      await stripe.paymentIntents.cancel(order.stripePaymentIntentId);
      order.paymentStatus = OrderPaymentStatus.UNPAID;
    } else if (
      order.paymentStatus === OrderPaymentStatus.PAID &&
      order.stripePaymentIntentId
    ) {
      await stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
      });
      order.paymentStatus = OrderPaymentStatus.REFUNDED;
    }
    await restoreVariantStock(order.variant?.id);

    order.status = OrderStatus.CANCELLED;
    const saved = await orderRepo.save(order);
    return res.json(saved);
  } catch (error) {
    return res.status(500).json({ message: "Error cancelling order", error });
  }
};

// Called from the webhook when an order/cart's PaymentIntent becomes
// authorized (hold placed, not yet captured). Only moves orders forward
// from UNPAID, so a later out-of-order event can't regress an
// already-captured or already-cancelled order.
export async function handleOrderAuthorizedEvent(orderIdsCsv: string) {
  const ids = orderIdsCsv.split(",").map((id) => id.trim()).filter(Boolean);
  await Promise.all(
    ids.map(async (id) => {
      const order = await orderRepo.findOne({ where: { id } });
      if (!order || order.paymentStatus !== OrderPaymentStatus.UNPAID) return;
      order.paymentStatus = OrderPaymentStatus.AUTHORIZED;
      await orderRepo.save(order);
    }),
  );
}

// Called from the shared Stripe webhook (booking.controller.ts) when a
// PaymentIntent tagged as an order or cart checkout is captured or fails.
// orderIdsCsv is a single id (type: "order") or a comma-separated list
// (type: "cart") — both share the same handling since a cart's PaymentIntent
// pays for all its line items together.
export async function handleOrderPaymentEvent(
  orderIdsCsv: string,
  succeeded: boolean,
) {
  const ids = orderIdsCsv.split(",").map((id) => id.trim()).filter(Boolean);
  const newStatus = succeeded
    ? OrderPaymentStatus.PAID
    : OrderPaymentStatus.FAILED;

  await Promise.all(
    ids.map(async (id) => {
      const order = await orderRepo.findOne({ where: { id } });
      if (!order) return;
      order.paymentStatus = newStatus;
      await orderRepo.save(order);
    }),
  );
}
