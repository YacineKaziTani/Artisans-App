import { z } from "zod";
import { emptyToUndefined, int, optionalText, uuid } from "../../lib/schemas";
import { DeliveryMethod, OrderStatus } from "./order.entities";

export const MAX_QUANTITY = 100;
export const MAX_CART_LINES = 50;

const lineItem = z.object({
  productId: uuid("productId"),
  variantId: z.preprocess(emptyToUndefined, uuid("variantId").optional()),
  quantity: int("Quantity", 1, MAX_QUANTITY).default(1),
});

const delivery = {
  deliveryMethod: z
    .enum(DeliveryMethod, { error: "Choose pickup or delivery" })
    .default(DeliveryMethod.PICKUP),
  shippingAddress: optionalText("Shipping address", 500),
};

function requireAddressForDelivery(
  body: { deliveryMethod: DeliveryMethod; shippingAddress?: string },
  ctx: z.RefinementCtx,
) {
  if (
    body.deliveryMethod === DeliveryMethod.DELIVERY &&
    !body.shippingAddress
  ) {
    ctx.addIssue({
      code: "custom",
      message: "A shipping address is required for delivery orders",
      path: ["shippingAddress"],
    });
  }
}

export const createOrderSchema = lineItem
  .extend(delivery)
  .superRefine(requireAddressForDelivery);

export const cartCheckoutSchema = z
  .object({
    items: z
      .array(lineItem, { error: "items must be a list" })
      .min(1, "Your cart is empty")
      .max(
        MAX_CART_LINES,
        `A single checkout can have at most ${MAX_CART_LINES} items`,
      ),
    ...delivery,
  })
  .superRefine(requireAddressForDelivery);

export const orderStatusSchema = z.object({
  status: z.enum(OrderStatus, { error: "Invalid status" }),
  trackingInfo: optionalText("Tracking info", 200),
});

export const abandonCheckoutSchema = z.object({
  orderIds: z
    .array(uuid("orderId"), { error: "orderIds must be a list" })
    .min(1, "orderIds must not be empty")
    .max(MAX_CART_LINES),
});

export type LineItemInput = z.infer<typeof lineItem>;
