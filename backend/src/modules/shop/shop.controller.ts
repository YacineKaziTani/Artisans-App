import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Shop, ShopStatus, VerificationStatus } from "./shop.entities";
import { Category } from "../category/category.entities";
import { User, UserRole } from "../users/entities/user.entities";
import { stripe } from "../../config/stripe";

const shopRepo = AppDataSource.getRepository(Shop);
const userRepo = AppDataSource.getRepository(User);
const categoryRepo = AppDataSource.getRepository(Category);
export const uploadShopPhoto = async (req: Request, res: Response) => {
  try {
    const imageUrl = req.file?.path;
    if (!imageUrl) {
      return res.status(400).json({ message: "No image file provided" });
    }
    res.status(200).json({
      success: true,
      url: imageUrl,
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        message: "Failed to upload image",
        error: error instanceof Error ? error.message : error,
      });
  }
};
export const createShop = async (req: Request, res: Response) => {
  try {
    const { shopName, description, address, city, phone, categoryId } =
      req.body;
    const imageUrl = req.file?.path;
    const userId = req.user!.id;

    const existing = await shopRepo.findOne({
      where: { owner: { id: userId } },
    });
    if (existing) {
      return res.status(400).json({ message: "You already have a shop" });
    }

    const category = await categoryRepo.findOne({
      where: { id: String(categoryId) },
    });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const owner = await userRepo.findOne({ where: { id: userId } });
    if (!owner) {
      return res.status(404).json({ message: "User not found" });
    }

    const shop = shopRepo.create({
      shopName,
      description,
      address,
      city,
      phone,
      category,
      logoUrl: imageUrl,
      owner,
      status: ShopStatus.PENDING,
    });

    const saved = await shopRepo.save(shop);

    await userRepo.update(userId, { role: UserRole.ARTISAN });

    return res.status(201).json({
      message: "Shop created waiting for approval",
      shop: saved,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

export const updateMyShop = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { shopName, description, address, city, phone, categoryId } =
      req.body;
    const imageUrl = req.file?.path;

    const shop = await shopRepo.findOne({
      where: { owner: { id: userId } },
      relations: { category: true },
    });

    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    if (shopName) shop.shopName = shopName;
    if (description) shop.description = description;
    if (address) shop.address = address;
    if (city) shop.city = city;
    if (phone) shop.phone = phone;
    if (imageUrl) shop.logoUrl = imageUrl;

    if (categoryId) {
      const category = await categoryRepo.findOne({
        where: { id: categoryId },
      });
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      shop.category = category;
    }

    const updated = await shopRepo.save(shop);
    return res.json({ message: "Shop updated", shop: updated });
  } catch (error) {
    return res.status(500).json({ message: "server error", error });
  }
};

export const getMyShop = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({
      where: { owner: { id: req.user!.id } },
      relations: {
        category: true,
        services: true,
        photos: true,
        products: {
          images: true,
          variantOptions: { values: true },
          variants: { values: { option: true } },
        },
        reviews: { author: true },
      },
    });

    if (!shop) return res.status(404).json({ message: "Shop not found" });

    return res.json(shop);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

export const getAllShops = async (req: Request, res: Response) => {
  try {
    const { category, city, search, page = "1", limit = "10" } = req.query;

    const qb = shopRepo
      .createQueryBuilder("shop")
      .leftJoinAndSelect("shop.category", "category")
      .leftJoinAndSelect("shop.owner", "owner")
      .leftJoinAndSelect("shop.photos", "photos")
      .where("shop.status = :status", { status: ShopStatus.ACTIVE });

    if (category) {
      qb.andWhere("LOWER(category.name) = LOWER(:category)", { category });
    }
    if (city) {
      qb.andWhere("LOWER(shop.city) LIKE LOWER(:city)", { city: `%${city}%` });
    }
    if (search) {
      qb.andWhere(
        "(LOWER(shop.shopName) LIKE LOWER(:search) OR LOWER(shop.description) LIKE LOWER(:search))",
        { search: `%${search}%` },
      );
    }

    const take = Math.min(Number(limit), 50);
    const skip = (Number(page) - 1) * take;

    const [shops, total] = await qb
      .orderBy("shop.averageRating", "DESC")
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return res.json({
      data: shops,
      meta: {
        total,
        page: Number(page),
        lastPage: Math.ceil(total / take),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "server error", error });
  }
};

export const getShopById = async (req: Request, res: Response) => {
  try {
    const shop = await shopRepo.findOne({
      where: {
        id: String(req.params.id),
        status: ShopStatus.ACTIVE,
      },
      relations: {
        category: true,
        services: true,
        photos: true,
        products: {
          images: true,
          variantOptions: { values: true },
          variants: { values: { option: true } },
        },
        reviews: { author: true },
        owner: true,
      },
    });

    if (!shop) return res.status(404).json({ message: "Shop not found" });

    return res.json(shop);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

// All shops regardless of status, for the super_admin dashboard
export const getAllShopsAdmin = async (req: Request, res: Response) => {
  try {
    const { status, page = "1", limit = "20" } = req.query;

    const qb = shopRepo
      .createQueryBuilder("shop")
      .leftJoinAndSelect("shop.category", "category")
      .leftJoinAndSelect("shop.owner", "owner");

    if (status) {
      qb.andWhere("shop.status = :status", { status });
    }

    const take = Math.min(Number(limit), 100);
    const skip = (Number(page) - 1) * take;

    const [shops, total] = await qb
      .orderBy("shop.createdAt", "DESC")
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return res.json({
      data: shops,
      meta: { total, page: Number(page), lastPage: Math.ceil(total / take) },
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

// Approve (activate) or suspend a shop (super_admin only)
export const updateShopStatus = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body as { status: ShopStatus };

    if (!Object.values(ShopStatus).includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const shop = await shopRepo.findOne({ where: { id } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    shop.status = status;
    const saved = await shopRepo.save(shop);
    return res.json({ message: "Shop status updated", shop: saved });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

// Artisan voluntarily closes their own shop. This is a soft close (status
// change), not a hard delete — bookings, orders, and reviews reference the
// shop without an onDelete cascade, so a hard delete would either fail on
// the foreign key or destroy financial/review history. A closed shop simply
// stops appearing in public listings (getAllShops/getShopById only return
// ACTIVE shops) and can be reopened later.
export const closeMyShop = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const shop = await shopRepo.findOne({ where: { owner: { id: userId } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    shop.status = ShopStatus.CLOSED;
    const saved = await shopRepo.save(shop);
    return res.json({ message: "Shop closed", shop: saved });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

export const reopenMyShop = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const shop = await shopRepo.findOne({ where: { owner: { id: userId } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    if (shop.status === ShopStatus.SUSPENDED) {
      return res
        .status(403)
        .json({ message: "This shop was suspended by an admin and can't be reopened directly" });
    }

    shop.status = ShopStatus.ACTIVE;
    const saved = await shopRepo.save(shop);
    return res.json({ message: "Shop reopened", shop: saved });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

// Artisan requests a verification badge for their own shop.
export const requestShopVerification = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const shop = await shopRepo.findOne({ where: { owner: { id: userId } } });
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
    shop.verificationNote = undefined;
    const saved = await shopRepo.save(shop);
    return res.json({ message: "Verification requested", shop: saved });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
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

    if (
      ![VerificationStatus.VERIFIED, VerificationStatus.REJECTED].includes(
        status,
      )
    ) {
      return res.status(400).json({ message: "Invalid verification status" });
    }

    const shop = await shopRepo.findOne({ where: { id } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    shop.verificationStatus = status;
    shop.verificationNote = note;
    const saved = await shopRepo.save(shop);
    return res.json({ message: "Verification updated", shop: saved });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

// Starts (or resumes) Stripe Connect onboarding for the logged-in artisan's
// shop. Creates an Express connected account on first call, then returns a
// fresh Stripe-hosted onboarding link every time — clients can't book or buy
// from this shop until onboarding actually completes.
//
// Uses the Accounts v2 API (/v2/core/accounts + /v2/core/account_links) —
// Stripe now rejects v1 account creation for new integrations. This mirrors
// Stripe's own "Build a marketplace" guide for the destination-charge
// pattern this app uses (transfer_data.destination + application_fee_amount
// on the PaymentIntent): the connected account needs BOTH the "merchant"
// configuration (to accept the card payment) and the "recipient"
// configuration (to receive the transferred funds) —
// https://docs.stripe.com/connect/end-to-end-marketplace
export const connectStripeAccount = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const shop = await shopRepo.findOne({ where: { owner: { id: userId } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    if (!shop.stripeAccountId) {
      // No `identity.country` set: this app doesn't collect the artisan's
      // country anywhere, so it's left for Stripe's onboarding flow to
      // collect directly. IMPORTANT: Stripe Connect (and card payouts
      // generally) is only available in a fixed list of supported
      // countries — if your artisans are outside that list, this will need
      // a real country field and per-country handling before it works for
      // them. See https://docs.stripe.com/connect/supported-countries.
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

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
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
    const message =
      error instanceof Error ? error.message : "Error starting Stripe onboarding";
    console.error("connectStripeAccount failed:", error);
    return res.status(500).json({ message });
  }
};

// Re-checks the connected account's status directly with Stripe (used after
// the artisan returns from onboarding, since the account.updated webhook
// might not have arrived yet, or isn't configured in this environment).
// "Onboarding complete" for our destination-charge setup means both
// capabilities we requested are active: the merchant side can accept card
// payments, and the recipient side can receive the transferred funds.
export const getStripeAccountStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const shop = await shopRepo.findOne({ where: { owner: { id: userId } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    if (!shop.stripeAccountId) {
      return res.json({ connected: false, onboardingComplete: false });
    }

    const account = await stripe.v2.core.accounts.retrieve(shop.stripeAccountId, {
      include: ["configuration.merchant", "configuration.recipient", "requirements"],
    });

    const cardPaymentsActive =
      account.configuration?.merchant?.capabilities?.card_payments?.status === "active";
    const transfersActive =
      account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers
        ?.status === "active";
    const onboardingComplete = cardPaymentsActive && transfersActive;

    if (onboardingComplete !== shop.stripeOnboardingComplete) {
      shop.stripeOnboardingComplete = onboardingComplete;
      await shopRepo.save(shop);
    }

    return res.json({
      connected: true,
      onboardingComplete,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error checking Stripe status";
    console.error("getStripeAccountStatus failed:", error);
    return res.status(500).json({ message });
  }
};
