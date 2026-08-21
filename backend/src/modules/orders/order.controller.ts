import { Request, Response } from "express";
import crypto from "crypto";
import { AppDataSource } from "../../data-source";
import { Order, OrderStatus, OrderPaymentStatus } from "./order.entities";
import { Shop } from "../shop/shop.entities";
import { Product } from "../products/product.entities";
import { User } from "../users/entities/user.entities";
import { UserRole } from "../users/entities/user.entities";
import { stripe } from "../../config/stripe";

const orderRepo = AppDataSource.getRepository(Order);
const shopRepo = AppDataSource.getRepository(Shop);
const productRepo = AppDataSource.getRepository(Product);

// Client orders a product and gets back a Stripe PaymentIntent client secret.
export const createOrder = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { productId, quantity = 1 } = req.body;

    if (!productId || quantity < 1) {
      return res
        .status(400)
        .json({ message: "productId and a valid quantity are required" });
    }

    const product = await productRepo.findOne({
      where: { id: productId },
      relations: ["shop"],
    });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const totalAmount = Number(product.basePrice) * Number(quantity);

    const order = orderRepo.create({
      client: { id: userId } as User,
      shop: product.shop,
      product,
      quantity,
      totalAmount,
      status: OrderStatus.PENDING,
      paymentStatus: OrderPaymentStatus.UNPAID,
    });
    const saved = await orderRepo.save(order);

    const amountInCents = Math.round(totalAmount * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      metadata: { type: "order", orderId: saved.id },
      automatic_payment_methods: { enabled: true },
    });

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
    const items = req.body.items as { productId: string; quantity: number }[];

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "items must be a non-empty array" });
    }
    if (items.some((i) => !i.productId || !i.quantity || i.quantity < 1)) {
      return res
        .status(400)
        .json({ message: "Each item needs a productId and a valid quantity" });
    }

    const productIds = items.map((i) => i.productId);
    const products = await productRepo.find({
      where: productIds.map((id) => ({ id })),
      relations: ["shop"],
    });
    if (products.length !== new Set(productIds).size) {
      return res.status(404).json({ message: "One or more products were not found" });
    }
    const productById = new Map(products.map((p) => [p.id, p]));

    const checkoutGroupId = crypto.randomUUID();
    let totalAmountCents = 0;

    const orders = await Promise.all(
      items.map(async (item) => {
        const product = productById.get(item.productId)!;
        const lineTotal = Number(product.basePrice) * item.quantity;
        totalAmountCents += Math.round(lineTotal * 100);

        const order = orderRepo.create({
          client: { id: userId } as User,
          shop: product.shop,
          product,
          quantity: item.quantity,
          totalAmount: lineTotal,
          status: OrderStatus.PENDING,
          paymentStatus: OrderPaymentStatus.UNPAID,
          checkoutGroupId,
        });
        return orderRepo.save(order);
      }),
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmountCents,
      currency: "usd",
      metadata: {
        type: "cart",
        orderIds: orders.map((o) => o.id).join(","),
      },
      automatic_payment_methods: { enabled: true },
    });

    await Promise.all(
      orders.map((o) => {
        o.stripePaymentIntentId = paymentIntent.id;
        return orderRepo.save(o);
      }),
    );

    return res.status(201).json({
      orders,
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
      relations: ["shop", "product"],
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
      relations: ["product", "client"],
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
      relations: ["shop", "product", "client"],
      order: { createdAt: "DESC" },
    });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching orders", error });
  }
};

// Artisan fulfills or cancels an order on their own shop.
// Cancelling a paid order triggers a Stripe refund.
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const { status } = req.body as { status: OrderStatus };

    if (!Object.values(OrderStatus).includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await orderRepo.findOne({
      where: { id },
      relations: ["shop", "shop.owner"],
    });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (
      order.shop.owner.id !== userId &&
      req.user!.role !== UserRole.SUPER_ADMIN
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (
      status === OrderStatus.CANCELLED &&
      order.paymentStatus === OrderPaymentStatus.PAID &&
      order.stripePaymentIntentId
    ) {
      await stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
      });
      order.paymentStatus = OrderPaymentStatus.REFUNDED;
    }

    order.status = status;
    const saved = await orderRepo.save(order);
    return res.json(saved);
  } catch (error) {
    return res.status(500).json({ message: "Error updating order", error });
  }
};

// Client cancels their own order (refunds automatically if it was paid)
export const cancelMyOrder = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const order = await orderRepo.findOne({
      where: { id },
      relations: ["client"],
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

    if (
      order.paymentStatus === OrderPaymentStatus.PAID &&
      order.stripePaymentIntentId
    ) {
      await stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
      });
      order.paymentStatus = OrderPaymentStatus.REFUNDED;
    }

    order.status = OrderStatus.CANCELLED;
    const saved = await orderRepo.save(order);
    return res.json(saved);
  } catch (error) {
    return res.status(500).json({ message: "Error cancelling order", error });
  }
};

// Called from the shared Stripe webhook (booking.controller.ts) when a
// PaymentIntent tagged as an order or cart checkout succeeds or fails.
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
