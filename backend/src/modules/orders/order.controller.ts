import { Request, Response } from "express";
import crypto from "crypto";
import { AppDataSource } from "../../data-source";
import {
  Order,
  OrderStatus,
  OrderPaymentStatus,
  DeliveryMethod,
} from "./order.entities";
import { Shop, ShopStatus } from "../shop/shop.entities";
import { Product } from "../products/product.entities";
import { ProductVariant } from "../products/variant.entities";
import { User } from "../users/entities/user.entities";
import { UserRole } from "../users/entities/user.entities";
import { parsePagination } from "../../middleware/validate.middleware";
import {
  stripe,
  shopCanAcceptPayments,
  connectChargeParams,
  connectRefundParams,
} from "../../config/stripe";

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
    deliveryMethod === DeliveryMethod.DELIVERY
      ? body.shippingAddress
      : undefined;
  return { deliveryMethod, shippingAddress };
}

async function resolveLineItem(
  productId: string,
  variantId: string | undefined,
  quantity: number,
) {
  const product = await productRepo.findOne({
    where: { id: productId },
    relations: ["shop"],
  });
  if (!product) return { error: "Product not found" as const };
  if (product.shop.status !== ShopStatus.ACTIVE) {
    return { error: "This shop isn't currently accepting orders." as const };
  }
  if (!shopCanAcceptPayments(product.shop)) {
    return {
      error:
        "This shop hasn't finished setting up payouts yet and can't accept orders." as const,
    };
  }

  if (!variantId) {
    return {
      product,
      variant: null,
      unitPrice: Number(product.basePrice),
      variantLabel: undefined,
    };
  }

  const variant = await variantRepo.findOne({
    where: { id: variantId },
    relations: ["product", "values", "values.option"],
  });
  if (!variant || variant.product.id !== productId) {
    return { error: "Variant not found for this product" as const };
  }
  if (variant.stockQuantity < quantity) {
    return {
      error: (variant.stockQuantity < 1
        ? "That variant is out of stock"
        : `Only ${variant.stockQuantity} left of that variant`) as string,
    };
  }

  const unitPrice =
    variant.priceOverride !== undefined && variant.priceOverride !== null
      ? Number(variant.priceOverride)
      : Number(product.basePrice) +
        variant.values.reduce((sum, v) => sum + Number(v.priceModifier), 0);

  const variantLabel = variant.values
    .map((v) => `${v.option.name}: ${v.value}`)
    .join(", ");

  variant.stockQuantity -= quantity;
  await variantRepo.save(variant);

  return { product, variant, unitPrice, variantLabel };
}

export async function restoreVariantStock(variantId?: string, quantity = 1) {
  if (!variantId) return;
  const variant = await variantRepo.findOne({ where: { id: variantId } });
  if (variant) {
    variant.stockQuantity += quantity;
    await variantRepo.save(variant);
  }
}

export const createOrder = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      productId,
      variantId,
      quantity = 1,
      deliveryMethod,
      shippingAddress,
    } = req.body;

    if (
      !productId ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 100
    ) {
      return res
        .status(400)
        .json({
          message:
            "productId and a whole quantity between 1 and 100 are required",
        });
    }

    const delivery = parseDelivery({ deliveryMethod, shippingAddress });
    if (
      delivery.deliveryMethod === DeliveryMethod.DELIVERY &&
      !delivery.shippingAddress?.trim()
    ) {
      return res
        .status(400)
        .json({ message: "shippingAddress is required for delivery orders" });
    }

    const resolved = await resolveLineItem(productId, variantId, quantity);
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
        ...connectChargeParams(product.shop, amountInCents),
      });
    } catch (err) {
      await restoreVariantStock(variant?.id, quantity);
      throw err;
    }

    saved.stripePaymentIntentId = paymentIntent.id;
    await orderRepo.save(saved);

    return res.status(201).json({
      order: saved,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error creating order" });
  }
};

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
      return res
        .status(400)
        .json({ message: "items must be a non-empty array" });
    }
    if (
      items.some(
        (i) =>
          !i.productId ||
          !Number.isInteger(i.quantity) ||
          i.quantity < 1 ||
          i.quantity > 100,
      )
    ) {
      return res
        .status(400)
        .json({
          message:
            "Each item needs a productId and a whole quantity between 1 and 100",
        });
    }

    const delivery = parseDelivery({ deliveryMethod, shippingAddress });
    if (
      delivery.deliveryMethod === DeliveryMethod.DELIVERY &&
      !delivery.shippingAddress?.trim()
    ) {
      return res
        .status(400)
        .json({ message: "shippingAddress is required for delivery orders" });
    }

    const checkoutGroupId = crypto.randomUUID();
    let totalAmountCents = 0;
    const createdOrders: Order[] = [];
    let checkoutShopId: string | undefined;

    try {
      for (const item of items) {
        const resolved = await resolveLineItem(
          item.productId,
          item.variantId,
          item.quantity,
        );
        if ("error" in resolved) {
          throw new Error(resolved.error);
        }
        const { product, variant, unitPrice, variantLabel } = resolved;

        if (!checkoutShopId) {
          checkoutShopId = product.shop.id;
        } else if (product.shop.id !== checkoutShopId) {
          throw new Error(
            "All items in one checkout must be from the same shop — check out separately for items from different shops.",
          );
        }

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
      await Promise.all(
        createdOrders.map((o) =>
          restoreVariantStock(o.variant?.id, o.quantity),
        ),
      );
      const message =
        err instanceof Error ? err.message : "Error checking out cart";
      return res.status(404).json({ message });
    }

    const shop = await shopRepo.findOne({ where: { id: checkoutShopId! } });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmountCents,
      currency: "usd",
      capture_method: "manual",
      metadata: {
        type: "cart",
        orderIds: createdOrders.map((o) => o.id).join(","),
      },
      automatic_payment_methods: { enabled: true },
      ...connectChargeParams(shop!, totalAmountCents),
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
    return res.status(500).json({ message: "Error checking out cart" });
  }
};

async function settleCheckoutGroup(groupId: string) {
  const siblings = await orderRepo.find({
    where: { checkoutGroupId: groupId },
  });
  if (siblings.length === 0) return;
  // Still waiting on another line, or the group already settled.
  if (siblings.some((o) => o.status === OrderStatus.PENDING)) return;
  if (!siblings.every((o) => o.paymentStatus === OrderPaymentStatus.AUTHORIZED))
    return;

  const intentId = siblings[0].stripePaymentIntentId;
  if (!intentId) return;

  const captureCents = siblings
    .filter((o) => o.status === OrderStatus.FULFILLED)
    .reduce((sum, o) => sum + Math.round(Number(o.totalAmount) * 100), 0);

  if (captureCents > 0) {
    await stripe.paymentIntents.capture(intentId, {
      amount_to_capture: captureCents,
    });
  } else {
    await stripe.paymentIntents.cancel(intentId);
  }

  await Promise.all(
    siblings.map((o) => {
      o.paymentStatus =
        o.status === OrderStatus.FULFILLED
          ? OrderPaymentStatus.PAID
          : OrderPaymentStatus.UNPAID;
      return orderRepo.save(o);
    }),
  );
}

export function refundScopeFor(order: Order) {
  return order.checkoutGroupId
    ? { amount: Math.round(Number(order.totalAmount) * 100) }
    : {};
}

export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const orders = await orderRepo.find({
      where: { client: { id: userId } },
      relations: [
        "shop",
        "product",
        "variant",
        "variant.values",
        "variant.values.option",
      ],
      order: { createdAt: "DESC" },
    });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching orders" });
  }
};

export const getShopOrders = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const shop = await shopRepo.findOne({ where: { owner: { id: userId } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const orders = await orderRepo.find({
      where: { shop: { id: shop.id } },
      relations: [
        "product",
        "client",
        "variant",
        "variant.values",
        "variant.values.option",
      ],
      order: { createdAt: "DESC" },
    });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching orders" });
  }
};

export const getAllOrdersAdmin = async (req: Request, res: Response) => {
  try {
    const { page, take, skip } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 200,
    });
    const [orders, total] = await orderRepo.findAndCount({
      relations: [
        "shop",
        "product",
        "client",
        "variant",
        "variant.values",
        "variant.values.option",
      ],
      order: { createdAt: "DESC" },
      skip,
      take,
    });
    return res.json({
      data: orders,
      meta: { total, page, lastPage: Math.ceil(total / take) },
    });
  } catch (error) {
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
    if (order.status === status) {
      if (order.checkoutGroupId) {
        try {
          await settleCheckoutGroup(order.checkoutGroupId);
        } catch (err) {
          return res.status(409).json({
            message:
              "Couldn't settle the payment for this cart — the authorization hold may have expired (holds last about 7 days).",
            error: err instanceof Error ? err.message : err,
          });
        }
        return res.json(await orderRepo.findOne({ where: { id: order.id } }));
      }
      return res.json(order);
    }
    if (order.status === OrderStatus.CANCELLED) {
      return res
        .status(400)
        .json({ message: "This order is already cancelled" });
    }

    const isGrouped = Boolean(order.checkoutGroupId);

    if (status === OrderStatus.FULFILLED) {
      if (order.paymentStatus === OrderPaymentStatus.UNPAID) {
        return res.status(400).json({
          message: "The client hasn't authorized payment for this order yet",
        });
      }
      if (
        !isGrouped &&
        order.paymentStatus === OrderPaymentStatus.AUTHORIZED &&
        order.stripePaymentIntentId
      ) {
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
      }
    }

    if (status === OrderStatus.CANCELLED) {
      if (
        order.paymentStatus === OrderPaymentStatus.AUTHORIZED &&
        order.stripePaymentIntentId
      ) {
        if (!isGrouped) {
          await stripe.paymentIntents.cancel(order.stripePaymentIntentId);
          order.paymentStatus = OrderPaymentStatus.UNPAID; // hold released, client was never charged
        }
      } else if (
        order.paymentStatus === OrderPaymentStatus.PAID &&
        order.stripePaymentIntentId
      ) {
        await stripe.refunds.create({
          payment_intent: order.stripePaymentIntentId,
          ...refundScopeFor(order),
          ...connectRefundParams(!order.checkoutGroupId),
        });
        order.paymentStatus = OrderPaymentStatus.REFUNDED;
      }
      await restoreVariantStock(order.variant?.id, order.quantity);
    }

    if (trackingInfo !== undefined) order.trackingInfo = trackingInfo;
    order.status = status;
    const saved = await orderRepo.save(order);

    if (isGrouped) {
      try {
        await settleCheckoutGroup(order.checkoutGroupId!);
      } catch (err) {
        return res.status(409).json({
          message:
            "Couldn't settle the payment for this cart — the authorization hold may have expired (holds last about 7 days).",
          error: err instanceof Error ? err.message : err,
        });
      }
    }

    return res.json(await orderRepo.findOne({ where: { id: saved.id } }));
  } catch (error) {
    return res.status(500).json({ message: "Error updating order" });
  }
};

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

    const isGrouped = Boolean(order.checkoutGroupId);

    if (
      order.paymentStatus === OrderPaymentStatus.AUTHORIZED &&
      order.stripePaymentIntentId
    ) {
      if (!isGrouped) {
        await stripe.paymentIntents.cancel(order.stripePaymentIntentId);
        order.paymentStatus = OrderPaymentStatus.UNPAID;
      }
    } else if (
      order.paymentStatus === OrderPaymentStatus.PAID &&
      order.stripePaymentIntentId
    ) {
      await stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
        ...refundScopeFor(order),
        ...connectRefundParams(!isGrouped),
      });
      order.paymentStatus = OrderPaymentStatus.REFUNDED;
    }
    await restoreVariantStock(order.variant?.id, order.quantity);

    order.status = OrderStatus.CANCELLED;
    const saved = await orderRepo.save(order);

    if (isGrouped) await settleCheckoutGroup(order.checkoutGroupId!);

    return res.json(await orderRepo.findOne({ where: { id: saved.id } }));
  } catch (error) {
    return res.status(500).json({ message: "Error cancelling order" });
  }
};

export async function handleOrderAuthorizedEvent(orderIdsCsv: string) {
  const ids = orderIdsCsv
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  await Promise.all(
    ids.map(async (id) => {
      const order = await orderRepo.findOne({ where: { id } });
      if (!order || order.paymentStatus !== OrderPaymentStatus.UNPAID) return;
      order.paymentStatus = OrderPaymentStatus.AUTHORIZED;
      await orderRepo.save(order);
    }),
  );
}

export async function handleOrderPaymentEvent(
  orderIdsCsv: string,
  succeeded: boolean,
) {
  const ids = orderIdsCsv
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const newStatus = succeeded
    ? OrderPaymentStatus.PAID
    : OrderPaymentStatus.FAILED;

  await Promise.all(
    ids.map(async (id) => {
      const order = await orderRepo.findOne({ where: { id } });
      if (!order) return;
      if (succeeded && order.status === OrderStatus.CANCELLED) return;
      order.paymentStatus = newStatus;
      await orderRepo.save(order);
    }),
  );
}
