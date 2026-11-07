import { Request, Response } from "express";
import { hasOpeningHours, type OpeningHours } from "../../lib/schedule";
import { In, IsNull, MoreThan, Not } from "typeorm";
import { AppDataSource } from "../../data-source";
import {
  Shop,
  ShopStatus,
  VerificationStatus,
  ownerShopView,
} from "./shop.entities";
import { accountView } from "../users/user.views";
import { Category } from "../category/category.entities";
import { User, UserRole } from "../users/entities/user.entities";
import { Service } from "../services/service.entities";
import { Product } from "../products/product.entities";
import { Order, OrderPaymentStatus, OrderStatus } from "../orders/order.entities";
import { Booking, BookingStatus } from "../booking/booking.entities";
import { Review } from "../reviews/review.entities";
import { shopCanAcceptPayments } from "../../config/connect";
import { fromCents, toCents } from "../../lib/money";
import { stripe } from "../../config/stripe";
import { pageResult, parsePagination } from "../../middleware/validate.middleware";
import { primaryFrontendUrl } from "../../lib/urls";
import { isUniqueViolation } from "../../lib/db";
import { notifyInBackground } from "../../notifications/deliver";
import {
  notifyShopStatusChanged,
  notifyVerificationResolved,
} from "../../notifications";

// Request bodies are validated by the zod schemas in shop.schemas.ts.

const shopRepo = AppDataSource.getRepository(Shop);
const userRepo = AppDataSource.getRepository(User);
const categoryRepo = AppDataSource.getRepository(Category);
const serviceRepo = AppDataSource.getRepository(Service);
const productRepo = AppDataSource.getRepository(Product);

/** Admins also see the owner's contact details, for moderation. */
function adminShopView(shop: Shop) {
  return {
    ...ownerShopView(shop),
    owner: shop.owner ? accountView(shop.owner) : null,
  };
}

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
function likePattern(value: unknown) {
  return `%${String(value).replace(/[\\%_]/g, "\\$&")}%`;
}

/** A shop's live (non-archived) services, oldest first. */
function activeServices(shopId: string) {
  return serviceRepo.find({
    where: { shop: { id: shopId }, archivedAt: IsNull() },
    order: { createdAt: "ASC" },
  });
}

export const createShop = async (req: Request, res: Response) => {
  try {
    const { shopName, description, address, city, phone, categoryId } =
      req.body;
    const userId = req.user!.id;

    if (await shopRepo.exists({ where: { owner: { id: userId } } })) {
      return res.status(409).json({ message: "You already have a shop" });
    }

    const category = await categoryRepo.findOne({
      where: { id: categoryId, isActive: true },
    });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const owner = await userRepo.findOne({ where: { id: userId } });
    if (!owner) return res.status(404).json({ message: "User not found" });

    let saved: Shop;
    try {
      saved = await shopRepo.save(
        shopRepo.create({
          shopName,
          description: description || null,
          address: address || null,
          city: city || null,
          phone: phone || null,
          category,
          logoUrl: req.file?.path ?? null,
          owner,
          status: ShopStatus.PENDING,
        }),
      );
    } catch (err) {
      // One shop per owner is a unique constraint; a double-submit loses here.
      if (isUniqueViolation(err)) {
        return res.status(409).json({ message: "You already have a shop" });
      }
      throw err;
    }

    if (owner.role !== UserRole.ARTISAN) {
      await userRepo.update(userId, { role: UserRole.ARTISAN });
    }

    return res.status(201).json({
      message: "Shop created waiting for approval",
      shop: ownerShopView(saved),
    });
  } catch (error) {
    console.error("createShop failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateMyShop = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { shopName, description, address, city, phone, categoryId } =
      req.body as Record<string, string | undefined>;

    const shop = await shopRepo.findOne({
      where: { owner: { id: userId } },
      relations: { category: true },
    });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    // undefined = leave unchanged; "" = clear (the old `if (description)`
    // checks made it impossible to ever empty a field).
    if (shopName !== undefined) shop.shopName = shopName;
    if (description !== undefined) shop.description = description || null;
    if (address !== undefined) shop.address = address || null;
    if (city !== undefined) shop.city = city || null;
    if (phone !== undefined) shop.phone = phone || null;
    if (req.file?.path) shop.logoUrl = req.file.path;

    if (categoryId && categoryId !== shop.category?.id) {
      const category = await categoryRepo.findOne({
        where: { id: categoryId, isActive: true },
      });
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      shop.category = category;
    }

    const updated = await shopRepo.save(shop);
    return res.json({ message: "Shop updated", shop: ownerShopView(updated) });
  } catch (error) {
    console.error("updateMyShop failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getMyShop = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({
      where: { owner: { id: req.user!.id } },
      relations: { category: true, photos: true },
    });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    shop.services = await activeServices(shop.id);
    return res.json(ownerShopView(shop));
  } catch (error) {
    console.error("getMyShop failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAllShops = async (req: Request, res: Response) => {
  try {
    const { category, city, search } = req.query;
    const minRating = Number(req.query.minRating);
    const sort = String(req.query.sort ?? "rating");
    const { page, take, skip } = parsePagination(req.query);

    const qb = shopRepo
      .createQueryBuilder("shop")
      .leftJoinAndSelect("shop.category", "category")
      .leftJoinAndSelect("shop.photos", "photos")
      .leftJoin("shop.owner", "owner")
      .addSelect(["owner.id", "owner.name", "owner.avatarUrl"])
      .where("shop.status = :status", { status: ShopStatus.ACTIVE });

    if (category) {
      qb.andWhere("LOWER(category.name) = LOWER(:category)", {
        category: String(category),
      });
    }
    if (city) {
      qb.andWhere("shop.city ILIKE :city", { city: likePattern(city) });
    }
    if (search) {
      qb.andWhere(
        "(shop.shopName ILIKE :search OR shop.description ILIKE :search)",
        { search: likePattern(search) },
      );
    }

    if (Number.isFinite(minRating) && minRating > 0) {
      qb.andWhere("shop.averageRating >= :minRating", { minRating });
    }

    if (sort === "newest") qb.orderBy("shop.createdAt", "DESC");
    else if (sort === "name") qb.orderBy("shop.shopName", "ASC");
    else qb.orderBy("shop.averageRating", "DESC");

    const [shops, total] = await qb
      // Tie-break so pages don't shuffle between requests.
      .addOrderBy("shop.id", "ASC")
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return res.json({
      data: shops,
      meta: { total, page, lastPage: Math.ceil(total / take) },
    });
  } catch (error) {
    console.error("getAllShops failed:", error);
    return res.status(500).json({ message: "server error" });
  }
};

export const getShopById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const shop = await shopRepo.findOne({
      where: { id, status: ShopStatus.ACTIVE },
      relations: { category: true, photos: true, owner: true },
      select: { owner: { id: true, name: true, avatarUrl: true } },
    });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    // Loaded separately rather than as joins on the shop query: joining
    // products × variants × values × photos multiplied into thousands of
    // rows, and relations can't be filtered for archived rows in a join.
    // (Reviews have their own paginated endpoint.)
    const [services, products] = await Promise.all([
      activeServices(id),
      productRepo.find({
        where: { shop: { id }, archivedAt: IsNull() },
        relations: {
          images: true,
          variantOptions: { values: true },
          variants: { values: { option: true } },
        },
        order: { createdAt: "DESC" },
        relationLoadStrategy: "query",
      }),
    ]);
    shop.services = services;
    shop.products = products;

    return res.json(shop);
  } catch (error) {
    console.error("getShopById failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAllShopsAdmin = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const { page, take, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const qb = shopRepo
      .createQueryBuilder("shop")
      .leftJoinAndSelect("shop.category", "category")
      .leftJoinAndSelect("shop.owner", "owner");

    if (status && Object.values(ShopStatus).includes(status as ShopStatus)) {
      qb.andWhere("shop.status = :status", { status });
    }

    const [shops, total] = await qb
      .orderBy("shop.createdAt", "DESC")
      .addOrderBy("shop.id", "ASC")
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return res.json({
      data: shops.map(adminShopView),
      meta: { total, page, lastPage: Math.ceil(total / take) },
    });
  } catch (error) {
    console.error("getAllShopsAdmin failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateShopStatus = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body as { status: ShopStatus };

    const shop = await shopRepo.findOne({ where: { id } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const changed = shop.status !== status;
    shop.status = status;
    const saved = await shopRepo.save(shop);
    if (changed) notifyInBackground(() => notifyShopStatusChanged(id));
    return res.json({ message: "Shop status updated", shop: ownerShopView(saved) });
  } catch (error) {
    console.error("updateShopStatus failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const closeMyShop = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({
      where: { owner: { id: req.user!.id } },
    });
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    if (shop.status !== ShopStatus.ACTIVE) {
      return res.status(400).json({ message: "Only an open shop can be closed" });
    }

    shop.status = ShopStatus.CLOSED;
    const saved = await shopRepo.save(shop);
    return res.json({ message: "Shop closed", shop: ownerShopView(saved) });
  } catch (error) {
    console.error("closeMyShop failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const reopenMyShop = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({
      where: { owner: { id: req.user!.id } },
    });
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    if (shop.status === ShopStatus.SUSPENDED) {
      return res.status(403).json({
        message:
          "This shop was suspended by an admin and can't be reopened directly",
      });
    }
    if (shop.status !== ShopStatus.CLOSED) {
      return res.status(400).json({
        message:
          shop.status === ShopStatus.PENDING
            ? "This shop is still awaiting admin approval"
            : "This shop is already open",
      });
    }

    shop.status = ShopStatus.ACTIVE;
    const saved = await shopRepo.save(shop);
    return res.json({ message: "Shop reopened", shop: ownerShopView(saved) });
  } catch (error) {
    console.error("reopenMyShop failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Artisan requests a verification badge for their own shop.
export const requestShopVerification = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({
      where: { owner: { id: req.user!.id } },
    });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    if (shop.verificationStatus === VerificationStatus.VERIFIED) {
      return res.status(400).json({ message: "Shop is already verified" });
    }
    if (shop.verificationStatus === VerificationStatus.PENDING) {
      return res
        .status(400)
        .json({ message: "A verification request is already pending" });
    }

    shop.verificationStatus = VerificationStatus.PENDING;
    // null, not undefined — save() skips undefined, so the previous
    // rejection note used to survive a new request.
    shop.verificationNote = null;
    const saved = await shopRepo.save(shop);
    return res.json({ message: "Verification requested", shop: ownerShopView(saved) });
  } catch (error) {
    console.error("requestShopVerification failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Admin approves or rejects a shop's verification request.
export const resolveShopVerification = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, note } = req.body as {
      status: VerificationStatus;
      note?: string;
    };

    const shop = await shopRepo.findOne({ where: { id } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    shop.verificationStatus = status;
    shop.verificationNote = note || null;
    const saved = await shopRepo.save(shop);
    notifyInBackground(() => notifyVerificationResolved(id));
    return res.json({ message: "Verification updated", shop: ownerShopView(saved) });
  } catch (error) {
    console.error("resolveShopVerification failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const connectStripeAccount = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({
      where: { owner: { id: req.user!.id } },
    });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    if (!shop.stripeAccountId) {
      const account = await stripe.v2.core.accounts.create({
        contact_email: req.user!.email,
        display_name: shop.shopName,
        dashboard: "express",
        defaults: {
          responsibilities: {
            fees_collector: "application",
            losses_collector: "application",
          },
        },
        configuration: {
          merchant: {
            capabilities: {
              card_payments: { requested: true },
            },
          },
          recipient: {
            capabilities: {
              stripe_balance: {
                stripe_transfers: { requested: true },
              },
            },
          },
        },
      });
      shop.stripeAccountId = account.id;
      await shopRepo.save(shop);
    }

    const frontendUrl = primaryFrontendUrl();
    const accountLink = await stripe.v2.core.accountLinks.create({
      account: shop.stripeAccountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["merchant", "recipient"],
          // Stripe requires both — refresh_url is used if the link itself
          // expires or onboarding is abandoned; return_url after completion.
          refresh_url: `${frontendUrl}/profile-artisan?stripe=refresh`,
          return_url: `${frontendUrl}/profile-artisan?stripe=return`,
        },
      },
    });

    return res.json({ url: accountLink.url });
  } catch (error) {
    console.error("connectStripeAccount failed:", error);
    return res
      .status(500)
      .json({ message: "Couldn't start Stripe onboarding. Please try again." });
  }
};

export const getStripeAccountStatus = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({
      where: { owner: { id: req.user!.id } },
    });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    if (!shop.stripeAccountId) {
      return res.json({ connected: false, onboardingComplete: false });
    }

    const onboardingComplete = await refreshStripeStatus(shop);
    return res.json({ connected: true, onboardingComplete });
  } catch (error) {
    console.error("getStripeAccountStatus failed:", error);
    return res
      .status(500)
      .json({ message: "Couldn't check your Stripe status. Please try again." });
  }
};

// ── Dashboard & admin views ────────────────────────────────────────────────

const PAID_OR_HELD = [OrderPaymentStatus.AUTHORIZED, OrderPaymentStatus.PAID];

/**
 * Numbers for the artisan dashboard: what needs action now, what's coming
 * up, and the last 30 days. Revenue is the gross amount clients paid
 * (before the platform commission and Stripe fees).
 */
export const getMyShopStats = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({ where: { owner: { id: req.user!.id } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    const shopId = shop.id;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const orders = AppDataSource.getRepository(Order);
    const bookings = AppDataSource.getRepository(Booking);

    const paidSince = (repo: typeof orders | typeof bookings, alias: string) =>
      repo
        .createQueryBuilder(alias)
        .select(`COALESCE(SUM(${alias}.totalAmount), 0)`, "total")
        .addSelect("COUNT(*)", "count")
        .where(`${alias}.shopId = :shopId`, { shopId })
        .andWhere(`${alias}.paymentStatus = :paid`, { paid: "paid" })
        .andWhere(`${alias}.createdAt >= :since`, { since })
        .getRawOne<{ total: string; count: string }>();

    const [
      ordersToFulfil,
      bookingsToConfirm,
      upcomingBookings,
      ordersPaid,
      bookingsPaid,
      reviewCount,
      productCount,
      serviceCount,
    ] = await Promise.all([
      orders.count({
        where: { shop: { id: shopId }, status: OrderStatus.PENDING, paymentStatus: In(PAID_OR_HELD) },
      }),
      bookings.count({
        where: { shop: { id: shopId }, status: BookingStatus.PENDING, paymentStatus: In(PAID_OR_HELD) },
      }),
      bookings.count({
        where: { shop: { id: shopId }, status: BookingStatus.CONFIRMED, scheduledAt: MoreThan(new Date()) },
      }),
      paidSince(orders, "o"),
      paidSince(bookings, "b"),
      AppDataSource.getRepository(Review).count({ where: { shop: { id: shopId } } }),
      productRepo.count({ where: { shop: { id: shopId }, archivedAt: IsNull() } }),
      serviceRepo.count({ where: { shop: { id: shopId }, archivedAt: IsNull() } }),
    ]);

    return res.json({
      ordersToFulfil,
      bookingsToConfirm,
      upcomingBookings,
      last30Days: {
        revenue: fromCents(toCents(ordersPaid?.total) + toCents(bookingsPaid?.total)),
        paidOrders: Number(ordersPaid?.count ?? 0),
        paidBookings: Number(bookingsPaid?.count ?? 0),
      },
      averageRating: shop.averageRating,
      reviewCount,
      productCount,
      serviceCount,
      status: shop.status,
      acceptsPayments: shopCanAcceptPayments(shop),
    });
  } catch (error) {
    console.error("getMyShopStats failed:", error);
    return res.status(500).json({ message: "Couldn't load your shop stats" });
  }
};

/**
 * Admin preview of any shop — including pending ones, which the public
 * endpoint hides — so an admin can see what they're approving.
 */
export const getShopAdmin = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const shop = await shopRepo.findOne({
      where: { id },
      relations: { category: true, photos: true, owner: true },
    });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const [services, products, productCount] = await Promise.all([
      activeServices(id),
      productRepo.find({
        where: { shop: { id }, archivedAt: IsNull() },
        order: { createdAt: "DESC" },
        take: 12,
      }),
      productRepo.count({ where: { shop: { id }, archivedAt: IsNull() } }),
    ]);
    shop.services = services;
    shop.products = products;

    return res.json({ ...adminShopView(shop), productCount });
  } catch (error) {
    console.error("getShopAdmin failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/** PUT /shops/mine/hours — time zone and weekly opening hours. */
export const updateMyHours = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({ where: { owner: { id: req.user!.id } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const { timezone, openingHours, bookingMinNoticeHours, bookingMaxDaysAhead } = req.body as {
      timezone: string;
      openingHours: OpeningHours | null;
      bookingMinNoticeHours?: number;
      bookingMaxDaysAhead?: number;
    };
    shop.timezone = timezone;
    if (bookingMinNoticeHours !== undefined) shop.bookingMinNoticeHours = bookingMinNoticeHours;
    if (bookingMaxDaysAhead !== undefined) shop.bookingMaxDaysAhead = bookingMaxDaysAhead;
    // Days with no periods are dropped; no periods at all = no fixed hours.
    const cleaned = openingHours
      ? (Object.fromEntries(
          Object.entries(openingHours)
            .filter(([, ranges]) => ranges && ranges.length)
            .map(([day, ranges]) => [day, [...ranges!].sort((a, b) => a.open.localeCompare(b.open))]),
        ) as OpeningHours)
      : null;
    shop.openingHours = hasOpeningHours(cleaned) ? cleaned : null;

    const saved = await shopRepo.save(shop);
    return res.json({ message: "Opening hours saved", shop: ownerShopView(saved) });
  } catch (error) {
    console.error("updateMyHours failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/** PUT /shops/mine/delivery — pickup/delivery options and the delivery fee. */
export const updateMyDelivery = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({ where: { owner: { id: req.user!.id } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const body = req.body as {
      pickupEnabled: boolean;
      deliveryEnabled: boolean;
      deliveryFee: number;
      freeDeliveryOver?: number | null;
      deliveryArea?: string;
    };
    shop.pickupEnabled = body.pickupEnabled;
    shop.deliveryEnabled = body.deliveryEnabled;
    shop.deliveryFee = body.deliveryFee;
    shop.freeDeliveryOver = body.freeDeliveryOver ?? null;
    shop.deliveryArea = body.deliveryArea || null;

    const saved = await shopRepo.save(shop);
    return res.json({ message: "Delivery options saved", shop: ownerShopView(saved) });
  } catch (error) {
    console.error("updateMyDelivery failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── Earnings ───────────────────────────────────────────────────────────────

/** Payments that reached the card: on hold, captured, or (partly) refunded. */
const EARNING_STATES = ["authorized", "paid", "partially_refunded", "refunded"];

const commissionPercent = () => Number(process.env.PLATFORM_COMMISSION_PERCENT ?? 10);

/** The artisan's orders and bookings as one list (SQL, so it can paginate). */
const EARNINGS_ROWS = `
  SELECT 'order' AS kind, o.id, o."createdAt" AS date, o."totalAmount" AS amount,
         o."deliveryFee" AS "deliveryFee", o."paymentStatus"::text AS "paymentStatus",
         o.status::text AS status,
         CONCAT(o.quantity, ' × ', COALESCE(p.title, 'item'),
                CASE WHEN o."variantLabel" IS NOT NULL THEN ' (' || o."variantLabel" || ')' ELSE '' END) AS title
    FROM orders o
    LEFT JOIN products p ON p.id = o."productId"
   WHERE o."shopId" = $1 AND o."paymentStatus"::text = ANY($2)
  UNION ALL
  SELECT 'booking', b.id, b."createdAt", b."totalAmount", 0, b."paymentStatus"::text,
         b.status::text, COALESCE(s.name, 'Booking')
    FROM bookings b
    LEFT JOIN services s ON s.id = b."serviceId"
   WHERE b."shopId" = $1 AND b."paymentStatus"::text = ANY($2)
`;

/**
 * GET /shops/mine/earnings — what clients paid, the platform commission and
 * what the artisan keeps, overall, this month and per sale. Stripe's own
 * dashboard (see getMyStripeDashboardLink) remains the record of payouts.
 */
export const getMyEarnings = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({ where: { owner: { id: req.user!.id } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const { page, take, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const percent = commissionPercent();
    const net = (cents: number) => cents - Math.round((cents * percent) / 100);

    const [rows, totals, [{ count }]] = await Promise.all([
      AppDataSource.query(
        `SELECT * FROM (${EARNINGS_ROWS}) t ORDER BY date DESC, id DESC LIMIT $3 OFFSET $4`,
        [shop.id, EARNING_STATES, take, skip],
      ),
      AppDataSource.query(
        `SELECT "paymentStatus",
                SUM(ROUND(amount * 100))::bigint AS cents,
                SUM(CASE WHEN date >= date_trunc('month', now() AT TIME ZONE $3) AT TIME ZONE $3
                         THEN ROUND(amount * 100) ELSE 0 END)::bigint AS "monthCents"
           FROM (${EARNINGS_ROWS}) t GROUP BY "paymentStatus"`,
        [shop.id, EARNING_STATES, shop.timezone || "UTC"],
      ),
      AppDataSource.query(`SELECT COUNT(*)::int AS count FROM (${EARNINGS_ROWS}) t`, [
        shop.id,
        EARNING_STATES,
      ]),
    ]);

    const byStatus = Object.fromEntries(
      (totals as { paymentStatus: string; cents: string; monthCents: string }[]).map((t) => [
        t.paymentStatus,
        { cents: Number(t.cents), monthCents: Number(t.monthCents) },
      ]),
    );
    const paid = byStatus.paid ?? { cents: 0, monthCents: 0 };

    return res.json({
      commissionPercent: percent,
      totals: {
        paidGross: fromCents(paid.cents),
        paidNet: fromCents(net(paid.cents)),
        thisMonthGross: fromCents(paid.monthCents),
        thisMonthNet: fromCents(net(paid.monthCents)),
        onHold: fromCents(byStatus.authorized?.cents ?? 0),
        refunded: fromCents((byStatus.refunded?.cents ?? 0) + (byStatus.partially_refunded?.cents ?? 0)),
      },
      ...pageResult(
        (rows as { kind: string; id: string; date: Date; amount: string; deliveryFee: string; paymentStatus: string; status: string; title: string }[]).map((r) => {
          const cents = toCents(r.amount);
          return {
            kind: r.kind,
            id: r.id,
            date: r.date,
            title: r.title,
            status: r.status,
            paymentStatus: r.paymentStatus,
            amount: fromCents(cents),
            deliveryFee: Number(r.deliveryFee) || 0,
            // Only captured payments are actually earned.
            net: r.paymentStatus === "paid" ? fromCents(net(cents)) : null,
          };
        }),
        count,
        page,
        take,
      ),
    });
  } catch (error) {
    console.error("getMyEarnings failed:", error);
    return res.status(500).json({ message: "Couldn't load your earnings" });
  }
};

/**
 * POST /shops/mine/stripe-dashboard — a one-time sign-in link to the
 * artisan's Stripe Express dashboard (payouts, bank details, tax forms).
 */
export const getMyStripeDashboardLink = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({ where: { owner: { id: req.user!.id } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    if (!shop.stripeAccountId) {
      return res.status(400).json({ message: "Set up payouts first — then your Stripe dashboard is available here." });
    }
    const link = await stripe.accounts.createLoginLink(shop.stripeAccountId);
    return res.json({ url: link.url });
  } catch (error) {
    console.error("getMyStripeDashboardLink failed:", error);
    return res.status(502).json({
      message: "Stripe couldn't open your dashboard right now. If you haven't finished payout setup, do that first.",
    });
  }
};

/**
 * Asks Stripe whether the shop's connected account can take card payments
 * and receive transfers, and stores the answer. Used by the dashboard and
 * by the periodic refresh (there's no Connect webhook), so a shop whose
 * account gets restricted stops taking payments without waiting for its
 * owner to open the dashboard.
 */
export async function refreshStripeStatus(shop: Shop): Promise<boolean> {
  if (!shop.stripeAccountId) return false;
  const account = await stripe.v2.core.accounts.retrieve(shop.stripeAccountId, {
    include: ["configuration.merchant", "configuration.recipient", "requirements"],
  });
  const cardPaymentsActive =
    account.configuration?.merchant?.capabilities?.card_payments?.status === "active";
  const transfersActive =
    account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === "active";
  const onboardingComplete = cardPaymentsActive && transfersActive;

  if (onboardingComplete !== shop.stripeOnboardingComplete) {
    await shopRepo.update(shop.id, { stripeOnboardingComplete: onboardingComplete });
    shop.stripeOnboardingComplete = onboardingComplete;
  }
  return onboardingComplete;
}

/** Refreshes every connected shop's Stripe status (oldest-checked first, capped). */
export async function refreshAllStripeStatuses(limit = 200) {
  const shops = await shopRepo.find({
    where: { stripeAccountId: Not(IsNull()) },
    order: { updatedAt: "ASC" },
    take: limit,
  });
  let changed = 0;
  for (const shop of shops) {
    const before = shop.stripeOnboardingComplete;
    try {
      if ((await refreshStripeStatus(shop)) !== before) changed++;
    } catch (err) {
      console.warn("[stripe] couldn't refresh status for shop", shop.id, err instanceof Error ? err.message : err);
    }
  }
  return changed;
}
