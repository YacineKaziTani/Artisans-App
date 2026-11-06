import { mock } from "node:test";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import request from "supertest";
import { AppDataSource } from "../src/data-source";
import { createApp } from "../src/app";
import { notificationsSettled } from "../src/notifications/deliver";
import { stripe } from "../src/config/stripe";
import { User, UserRole } from "../src/modules/users/entities/user.entities";
import { Shop, ShopStatus } from "../src/modules/shop/shop.entities";
import { Category } from "../src/modules/category/category.entities";
import { Service } from "../src/modules/services/service.entities";
import { Product } from "../src/modules/products/product.entities";

// The module's real exports object — `import * as` would give a copy whose
// properties are getters, and stubbing that wouldn't reach deliver.ts.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mail = require("../src/config/mail") as typeof import("../src/config/mail");

export const app = createApp();
export const api = () => request(app);

// ── Database ───────────────────────────────────────────────────────────────

/** Empties every table (the schema itself comes from the migrations). */
export async function resetDatabase() {
  // Let background notifications from the previous test finish first —
  // truncating under them caused foreign-key errors and deadlocks.
  await notificationsSettled();
  const tables = AppDataSource.entityMetadatas
    .map((meta) => `"${meta.tableName}"`)
    .join(", ");
  await AppDataSource.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
  fakeStripe.reset();
  sentEmails.length = 0;
}

// ── Seeding ────────────────────────────────────────────────────────────────

let seq = 0;
const next = () => ++seq;

export const TEST_PASSWORD = "correct-horse-battery";
let passwordHash: string | undefined;

export async function createUser(
  role: UserRole = UserRole.CLIENT,
  overrides: Partial<User> = {},
) {
  passwordHash ??= await bcrypt.hash(TEST_PASSWORD, 4);
  const n = next();
  return AppDataSource.getRepository(User).save(
    AppDataSource.getRepository(User).create({
      name: `User ${n}`,
      email: `user${n}@example.test`,
      phone: `+1555000${String(n).padStart(4, "0")}`,
      password: passwordHash,
      role,
      acceptedTermsAt: new Date(),
      // Accounts made here count as confirmed; sign-ups through the API don't.
      emailVerifiedAt: new Date(),
      ...overrides,
    }),
  );
}

export async function createShop(
  owner?: User,
  overrides: Partial<Shop> = {},
) {
  const n = next();
  const shopOwner = owner ?? (await createUser(UserRole.ARTISAN));
  const category = await AppDataSource.getRepository(Category).save({
    name: `Category ${n}`,
  });
  const shop = await AppDataSource.getRepository(Shop).save(
    AppDataSource.getRepository(Shop).create({
      shopName: `Shop ${n}`,
      city: "Testville",
      status: ShopStatus.ACTIVE,
      owner: shopOwner,
      category,
      stripeAccountId: "acct_secret_should_never_leak",
      verificationNote: "internal admin note",
      ...overrides,
    }),
  );
  return { shop, owner: shopOwner, category };
}

export async function createProduct(shop: Shop, overrides: Partial<Product> = {}) {
  const n = next();
  return AppDataSource.getRepository(Product).save(
    AppDataSource.getRepository(Product).create({
      title: `Product ${n}`,
      basePrice: 25,
      stockQuantity: null,
      shop,
      ...overrides,
    }),
  );
}

export async function createService(shop: Shop, overrides: Partial<Service> = {}) {
  const n = next();
  return AppDataSource.getRepository(Service).save(
    AppDataSource.getRepository(Service).create({
      name: `Service ${n}`,
      price: 40,
      durationMinutes: 60,
      isAvailable: true,
      shop,
      ...overrides,
    }),
  );
}

/** The auth cookie the API would set after logging this user in. */
export function authCookie(user: Pick<User, "id" | "name" | "email" | "role">) {
  const token = jwt.sign(
    { sub: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" },
  );
  return `token=${token}`;
}

// ── Stripe ─────────────────────────────────────────────────────────────────
// An in-memory stand-in for the handful of Stripe calls the API makes, so
// tests never touch the network and can drive payments through webhooks.

type FakeIntentStatus =
  | "requires_payment_method"
  | "requires_capture"
  | "succeeded"
  | "canceled";

interface FakeIntent {
  id: string;
  object: "payment_intent";
  amount: number;
  amount_capturable: number;
  amount_received: number;
  status: FakeIntentStatus;
  metadata: Record<string, string>;
  client_secret: string;
}

let intentSeq = 0;
let eventSeq = 0;

export const fakeStripe = {
  intents: new Map<string, FakeIntent>(),
  refunds: [] as Record<string, unknown>[],

  reset() {
    this.intents.clear();
    this.refunds.length = 0;
  },

  /** The intent the API created most recently. */
  latestIntent() {
    const all = [...this.intents.values()];
    return all[all.length - 1];
  },

  /** Simulates the client confirming their card (a manual-capture hold). */
  authorize(intentId: string) {
    const intent = this.intents.get(intentId);
    if (!intent) throw new Error(`No fake intent ${intentId}`);
    intent.status = "requires_capture";
    intent.amount_capturable = intent.amount;
    return intent;
  },
};

function getIntent(id: string) {
  const intent = fakeStripe.intents.get(id);
  if (!intent) throw new Error(`No such payment_intent: '${id}'`);
  return intent;
}

export function installFakeStripe() {
  // `as never` — the real method signatures are heavily overloaded.
  mock.method(stripe.paymentIntents, "create", async (params: {
    amount: number;
    metadata?: Record<string, string>;
  }) => {
    const id = `pi_test_${++intentSeq}`;
    const intent: FakeIntent = {
      id,
      object: "payment_intent",
      amount: params.amount,
      amount_capturable: 0,
      amount_received: 0,
      status: "requires_payment_method",
      metadata: params.metadata ?? {},
      client_secret: `${id}_secret_test`,
    };
    fakeStripe.intents.set(id, intent);
    return { ...intent };
  }) as never;

  mock.method(stripe.paymentIntents, "retrieve", async (id: string) => ({
    ...getIntent(id),
  })) as never;

  mock.method(stripe.paymentIntents, "cancel", async (id: string) => {
    const intent = getIntent(id);
    if (intent.status === "succeeded") {
      throw new Error("You cannot cancel this PaymentIntent because it has a status of succeeded.");
    }
    intent.status = "canceled";
    intent.amount_capturable = 0;
    return { ...intent };
  }) as never;

  mock.method(
    stripe.paymentIntents,
    "capture",
    async (id: string, params?: { amount_to_capture?: number }) => {
      const intent = getIntent(id);
      if (intent.status !== "requires_capture") {
        throw new Error(`This PaymentIntent could not be captured because it has a status of ${intent.status}.`);
      }
      intent.status = "succeeded";
      intent.amount_received = params?.amount_to_capture ?? intent.amount;
      intent.amount_capturable = 0;
      return { ...intent };
    },
  ) as never;

  mock.method(stripe.refunds, "create", async (params: Record<string, unknown>) => {
    const refund = { id: `re_test_${fakeStripe.refunds.length + 1}`, ...params };
    fakeStripe.refunds.push(refund);
    return refund;
  }) as never;

  // Webhook "signature": the tests sign with the literal "valid".
  mock.method(
    stripe.webhooks,
    "constructEvent",
    (payload: Buffer | string, signature: string) => {
      if (signature !== "valid") throw new Error("No signatures found matching the expected signature");
      return JSON.parse(payload.toString());
    },
  ) as never;

  // No email leaves the test run — each one is recorded instead.
  mock.method(mail, "sendMail", async (to: string, subject: string, html: string, replyTo?: string) => {
    sentEmails.push({ to, subject, html, replyTo });
  });
}

/** Posts a Stripe webhook event for a fake intent, as Stripe would. */
export function sendWebhook(
  type: string,
  intent: FakeIntent,
  options: { eventId?: string; signature?: string } = {},
) {
  const event = {
    id: options.eventId ?? `evt_test_${++eventSeq}`,
    object: "event",
    type,
    data: { object: intent },
  };
  return api()
    .post("/api/bookings/webhook")
    .set("stripe-signature", options.signature ?? "valid")
    .set("content-type", "application/json")
    .send(JSON.stringify(event));
}

// ── Email ──────────────────────────────────────────────────────────────────

export const sentEmails: { to: string; subject: string; html: string; replyTo?: string }[] = [];

/**
 * Waits for an email to `to` (most are sent in the background after the
 * response) and returns the 64-hex-char token from the link in it.
 */
export async function tokenFromEmail(to: string, subject: RegExp) {
  for (let i = 0; i < 100; i++) {
    const email = [...sentEmails].reverse().find((e) => e.to === to && subject.test(e.subject));
    const token = email?.html.match(/token=([0-9a-f]{64})/)?.[1];
    if (token) return token;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`No "${subject}" email with a link was sent to ${to}`);
}

// ── Cloudinary ─────────────────────────────────────────────────────────────

/** Public ids the app asked Cloudinary to delete. */
export const destroyedUploads: string[] = [];

export function installFakeCloudinary() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { v2: cloudinary } = require("cloudinary") as typeof import("cloudinary");
  mock.method(cloudinary.uploader, "destroy", async (publicId: string) => {
    destroyedUploads.push(publicId);
    return { result: "ok" };
  });
}
