import { Request, Response } from "express";
import { In } from "typeorm";
import { AppDataSource } from "../../data-source";
import { CustomRequest, CustomRequestStatus, MAX_REQUEST_PHOTOS } from "./custom-request.entities";
import { Shop, ShopStatus } from "../shop/shop.entities";
import { User } from "../users/entities/user.entities";
import {
  DeliveryMethod,
  Order,
  OrderPaymentStatus,
  OrderStatus,
} from "../orders/order.entities";
import {
  CheckoutError,
  assertChargeable,
  assertNotOnHoliday,
  deliveryChargeCents,
  deliveryFields,
  discardUnpaidOrder,
  handleOrderIntentAuthorized,
  handleOrderIntentCaptured,
  openPaymentIntent,
  runCheckout,
} from "../orders/order.controller";
import { closeUnpaidIntent, shopCanAcceptPayments } from "../../config/stripe";
import { fromCents, toCents } from "../../lib/money";
import { pageResult, parsePagination } from "../../middleware/validate.middleware";
import { destroyUpload, type CloudinaryFile } from "../../lib/uploads";
import { notifyInBackground } from "../../notifications/deliver";
import {
  notifyCustomRequestCancelled,
  notifyCustomRequestCreated,
  notifyCustomRequestDeclined,
  notifyCustomRequestQuoted,
} from "../../notifications";

const requestRepo = AppDataSource.getRepository(CustomRequest);
const shopRepo = AppDataSource.getRepository(Shop);
const orderRepo = AppDataSource.getRepository(Order);

/** Open requests one client may have waiting at one shop (spam guard). */
const MAX_OPEN_PER_SHOP = 3;
const OPEN = [CustomRequestStatus.REQUESTED, CustomRequestStatus.QUOTED];
const LIST_PAGE = { defaultLimit: 20, maxLimit: 50 };

const RELATIONS = { client: true, shop: { owner: true } } as const;

/** Both parties see the same thing; the shop is trimmed to what a card needs. */
function view(request: CustomRequest, order?: Order | null) {
  const { shop, client, ...rest } = request;
  return {
    ...rest,
    client: client ? { id: client.id, name: client.name, avatarUrl: client.avatarUrl ?? null } : null,
    shop: shop
      ? {
          id: shop.id,
          shopName: shop.shopName,
          logoUrl: shop.logoUrl ?? null,
          ownerId: shop.owner?.id ?? null,
          pickupEnabled: shop.pickupEnabled,
          deliveryEnabled: shop.deliveryEnabled,
          deliveryFee: shop.deliveryFee,
          freeDeliveryOver: shop.freeDeliveryOver ?? null,
          deliveryArea: shop.deliveryArea ?? null,
          city: shop.city ?? null,
        }
      : null,
    order: order
      ? { id: order.id, status: order.status, paymentStatus: order.paymentStatus, totalAmount: order.totalAmount }
      : null,
  };
}

async function withOrders(requests: CustomRequest[]) {
  const ids = requests.flatMap((r) => (r.orderId ? [r.orderId] : []));
  const orders = ids.length ? await orderRepo.find({ where: { id: In(ids) } }) : [];
  const byId = new Map(orders.map((o) => [o.id, o]));
  return requests.map((r) => view(r, r.orderId ? byId.get(r.orderId) : null));
}

async function loadForParticipant(id: string, userId: string) {
  const request = await requestRepo.findOne({ where: { id }, relations: RELATIONS });
  if (!request) return { request: null, asClient: false, asArtisan: false };
  return {
    request,
    asClient: request.client.id === userId,
    asArtisan: request.shop.owner?.id === userId,
  };
}

/** POST /custom-requests — a client asks a shop for a custom piece. */
export const createCustomRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { shopId, description, budget, neededBy } = req.body as {
      shopId: string;
      description: string;
      budget?: number | null;
      neededBy?: string | null;
    };
    const shop = await shopRepo.findOne({ where: { id: shopId, status: ShopStatus.ACTIVE }, relations: { owner: true } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    if (shop.owner?.id === userId) {
      return res.status(400).json({ message: "You can't send a custom request to your own shop" });
    }
    const open = await requestRepo.count({
      where: { client: { id: userId }, shop: { id: shop.id }, status: In(OPEN) },
    });
    if (open >= MAX_OPEN_PER_SHOP) {
      return res.status(429).json({
        message: `You already have ${open} open requests with this shop — wait for a reply, or withdraw one first.`,
      });
    }
    const saved = await requestRepo.save(
      requestRepo.create({
        client: { id: userId } as User,
        shop,
        description,
        budget: budget ?? null,
        neededBy: neededBy ?? null,
        status: CustomRequestStatus.REQUESTED,
      }),
    );
    notifyInBackground(() => notifyCustomRequestCreated(saved.id));
    const full = await requestRepo.findOneOrFail({ where: { id: saved.id }, relations: RELATIONS });
    return res.status(201).json(view(full));
  } catch (error) {
    console.error("createCustomRequest failed:", error);
    return res.status(500).json({ message: "Couldn't send your request" });
  }
};

/** POST /custom-requests/:id/photos (multipart "image") — reference photos. */
export const addCustomRequestPhoto = async (req: Request, res: Response) => {
  const file = req.file as CloudinaryFile | undefined;
  try {
    if (!file?.path) return res.status(400).json({ message: "Choose an image to upload" });
    const { request, asClient } = await loadForParticipant(String(req.params.id), req.user!.id);
    const refuse = async (status: number, message: string) => {
      await destroyUpload(file.filename);
      return res.status(status).json({ message });
    };
    if (!request) return refuse(404, "Request not found");
    if (!asClient) return refuse(403, "Forbidden");
    if (!OPEN.includes(request.status)) return refuse(400, "This request is closed");
    const photos = request.photos ?? [];
    if (photos.length >= MAX_REQUEST_PHOTOS) return refuse(400, `At most ${MAX_REQUEST_PHOTOS} photos per request`);
    request.photos = [...photos, { url: file.path, publicId: file.filename ?? "" }];
    await requestRepo.save(request);
    return res.json((await withOrders([request]))[0]);
  } catch (error) {
    console.error("addCustomRequestPhoto failed:", error);
    await destroyUpload(file?.filename);
    return res.status(500).json({ message: "Couldn't add that photo" });
  }
};

/** GET /custom-requests/mine — the client's requests. */
export const getMyCustomRequests = async (req: Request, res: Response) => {
  try {
    const { page, take, skip } = parsePagination(req.query, LIST_PAGE);
    const [rows, total] = await requestRepo.findAndCount({
      where: { client: { id: req.user!.id } },
      relations: RELATIONS,
      order: { updatedAt: "DESC", id: "ASC" },
      skip,
      take,
    });
    return res.json(pageResult(await withOrders(rows), total, page, take));
  } catch (error) {
    console.error("getMyCustomRequests failed:", error);
    return res.status(500).json({ message: "Couldn't load your requests" });
  }
};

/** GET /custom-requests/shop — requests to the artisan's shop, open ones first. */
export const getShopCustomRequests = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({ where: { owner: { id: req.user!.id } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    const { page, take, skip } = parsePagination(req.query, LIST_PAGE);
    const [rows, total] = await requestRepo
      .createQueryBuilder("r")
      .leftJoinAndSelect("r.client", "client")
      .leftJoinAndSelect("r.shop", "shop")
      .leftJoinAndSelect("shop.owner", "owner")
      .where('r."shopId" = :shopId', { shopId: shop.id })
      .orderBy(`CASE r.status WHEN 'requested' THEN 0 WHEN 'quoted' THEN 1 ELSE 2 END`, "ASC")
      .addOrderBy("r.updatedAt", "DESC")
      .addOrderBy("r.id", "ASC")
      .skip(skip)
      .take(take)
      .getManyAndCount();
    return res.json(pageResult(await withOrders(rows), total, page, take));
  } catch (error) {
    console.error("getShopCustomRequests failed:", error);
    return res.status(500).json({ message: "Couldn't load requests" });
  }
};

/** GET /custom-requests/:id — either party. */
export const getCustomRequest = async (req: Request, res: Response) => {
  try {
    const { request, asClient, asArtisan } = await loadForParticipant(String(req.params.id), req.user!.id);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (!asClient && !asArtisan) return res.status(403).json({ message: "Forbidden" });
    return res.json((await withOrders([request]))[0]);
  } catch (error) {
    console.error("getCustomRequest failed:", error);
    return res.status(500).json({ message: "Couldn't load this request" });
  }
};

/** PATCH /custom-requests/:id/quote — the artisan names a price (or revises it). */
export const quoteCustomRequest = async (req: Request, res: Response) => {
  try {
    const { request, asArtisan } = await loadForParticipant(String(req.params.id), req.user!.id);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (!asArtisan) return res.status(403).json({ message: "Forbidden" });
    if (!OPEN.includes(request.status)) return res.status(400).json({ message: "This request is closed" });
    // A checkout the client started for the old price is closed, so they
    // can't go on to pay a quote that no longer stands.
    const earlier = await closeEarlierAttempt(request.orderId);
    if (earlier === "paid" || earlier === "busy") {
      return res.status(409).json({ message: "The client has just paid for this quote — it can't be changed." });
    }
    request.orderId = null;
    const { price, readyBy, note } = req.body as { price: number; readyBy?: string | null; note?: string };
    request.quotePrice = price;
    request.quoteReadyBy = readyBy ?? null;
    request.quoteNote = note || null;
    request.quotedAt = new Date();
    request.status = CustomRequestStatus.QUOTED;
    await requestRepo.save(request);
    notifyInBackground(() => notifyCustomRequestQuoted(request.id));
    return res.json((await withOrders([request]))[0]);
  } catch (error) {
    console.error("quoteCustomRequest failed:", error);
    return res.status(500).json({ message: "Couldn't send the quote" });
  }
};

/**
 * Closes the unpaid order left from an earlier "accept" (the client backed
 * out of paying). "paid" if it turns out the card was held after all,
 * "busy" if Stripe is still processing it.
 */
async function closeEarlierAttempt(orderId: string | null | undefined): Promise<"none" | "closed" | "paid" | "busy"> {
  if (!orderId) return "none";
  const order = await orderRepo.findOne({ where: { id: orderId }, relations: { variant: true } });
  if (!order || order.status === OrderStatus.CANCELLED) return "none";
  if (order.paymentStatus !== OrderPaymentStatus.UNPAID && order.paymentStatus !== OrderPaymentStatus.FAILED) {
    return "paid";
  }
  const outcome = await closeUnpaidIntent(order.stripePaymentIntentId);
  if (outcome === "authorized") {
    await handleOrderIntentAuthorized(order.stripePaymentIntentId!);
    return "paid";
  }
  if (outcome === "captured") {
    await handleOrderIntentCaptured(order.stripePaymentIntentId!);
    return "paid";
  }
  if (outcome === "in_flight") return "busy";
  await discardUnpaidOrder(order);
  return "closed";
}

/** PATCH /custom-requests/:id/decline — the artisan passes, with an optional note. */
export const declineCustomRequest = async (req: Request, res: Response) => {
  try {
    const { request, asArtisan } = await loadForParticipant(String(req.params.id), req.user!.id);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (!asArtisan) return res.status(403).json({ message: "Forbidden" });
    if (!OPEN.includes(request.status)) return res.status(400).json({ message: "This request is closed" });
    const earlier = await closeEarlierAttempt(request.orderId);
    if (earlier === "paid" || earlier === "busy") {
      return res.status(409).json({ message: "The client has just paid for this quote — manage it from your orders." });
    }
    request.status = CustomRequestStatus.DECLINED;
    request.quoteNote = (req.body as { note?: string }).note || request.quoteNote || null;
    request.orderId = null;
    await requestRepo.save(request);
    notifyInBackground(() => notifyCustomRequestDeclined(request.id));
    return res.json((await withOrders([request]))[0]);
  } catch (error) {
    console.error("declineCustomRequest failed:", error);
    return res.status(500).json({ message: "Couldn't decline the request" });
  }
};

/** PATCH /custom-requests/:id/cancel — the client withdraws it. */
export const cancelCustomRequest = async (req: Request, res: Response) => {
  try {
    const { request, asClient } = await loadForParticipant(String(req.params.id), req.user!.id);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (!asClient) return res.status(403).json({ message: "Forbidden" });
    if (!OPEN.includes(request.status)) return res.status(400).json({ message: "This request is already closed" });
    const earlier = await closeEarlierAttempt(request.orderId);
    if (earlier === "paid" || earlier === "busy") {
      return res.status(409).json({ message: "You've already paid for this — cancel the order from your orders instead." });
    }
    request.status = CustomRequestStatus.CANCELLED;
    request.orderId = null;
    await requestRepo.save(request);
    notifyInBackground(() => notifyCustomRequestCancelled(request.id));
    return res.json((await withOrders([request]))[0]);
  } catch (error) {
    console.error("cancelCustomRequest failed:", error);
    return res.status(500).json({ message: "Couldn't withdraw the request" });
  }
};

/**
 * POST /custom-requests/:id/accept — the client accepts the quote: it
 * becomes an order (card hold now, charge when the artisan fulfils it),
 * paid with the same payment form as any order.
 */
export const acceptCustomRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { request, asClient } = await loadForParticipant(String(req.params.id), userId);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (!asClient) return res.status(403).json({ message: "Forbidden" });
    if (request.status !== CustomRequestStatus.QUOTED || request.quotePrice == null) {
      return res.status(400).json({ message: "There's no quote to accept on this request" });
    }

    // A previous attempt the client didn't finish paying is replaced.
    const earlier = await closeEarlierAttempt(request.orderId);
    if (earlier === "paid") return res.status(409).json({ message: "You've already paid for this quote" });
    if (earlier === "busy") return res.status(409).json({ message: "Your last payment is still processing — try again in a minute" });

    const delivery = deliveryFields(req.body as { deliveryMethod: DeliveryMethod; shippingAddress?: string });
    const reserved = await runCheckout(async (manager) => {
      const shop = await manager.findOne(Shop, { where: { id: request.shop.id } });
      if (!shop || shop.status !== ShopStatus.ACTIVE) {
        throw new CheckoutError(400, "This shop isn't currently accepting orders.");
      }
      if (!shopCanAcceptPayments(shop)) {
        throw new CheckoutError(400, "This shop hasn't finished setting up payouts yet and can't accept orders.");
      }
      assertNotOnHoliday(shop);
      // Only one checkout per quote at a time.
      const claimed = await manager.query(
        `SELECT id FROM custom_requests WHERE id = $1 AND status = 'quoted' FOR UPDATE`,
        [request.id],
      );
      if (!claimed.length) throw new CheckoutError(409, "This quote just changed — refresh and try again");

      const itemsCents = toCents(request.quotePrice!);
      const feeCents = deliveryChargeCents(shop, delivery.deliveryMethod, itemsCents);
      const totalCents = itemsCents + feeCents;
      assertChargeable(totalCents);

      const firstLine = request.description.split(/\r?\n/)[0].trim();
      const order = await manager.save(
        manager.create(Order, {
          client: { id: userId } as User,
          shop,
          productId: null,
          title: `Custom: ${firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine}`,
          customRequestId: request.id,
          quantity: 1,
          totalAmount: fromCents(totalCents),
          deliveryFee: fromCents(feeCents),
          status: OrderStatus.PENDING,
          paymentStatus: OrderPaymentStatus.UNPAID,
          ...delivery,
        }),
      );
      await manager.update(CustomRequest, { id: request.id }, { orderId: order.id });
      return { order, shop };
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
    console.error("acceptCustomRequest failed:", error);
    return res.status(500).json({ message: "Couldn't start the payment" });
  }
};
