import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppDataSource } from "../src/data-source";
import { User, UserRole } from "../src/modules/users/entities/user.entities";
import { Shop } from "../src/modules/shop/shop.entities";
import { Conversation } from "../src/modules/messaging/conversation.entities";
import { Message } from "../src/modules/messaging/message.entities";
import { Booking, BookingStatus, PaymentStatus } from "../src/modules/booking/booking.entities";
import { Order, OrderPaymentStatus, OrderStatus, DeliveryMethod } from "../src/modules/orders/order.entities";
import { AdminAction } from "../src/modules/audit/admin-action.entities";
import { notifyUnreadMessages } from "../src/notifications";
import { autoCompleteBookings, sendBookingReminders } from "../src/modules/booking/booking.controller";
import { refreshAllStripeStatuses } from "../src/modules/shop/shop.controller";
import { notificationsSettled } from "../src/notifications/deliver";
import { totpCode } from "../src/lib/totp";
import {
  api,
  authCookie,
  createProduct,
  createService,
  createShop,
  createUser,
  fakeStripe,
  resetDatabase,
  sentEmails,
  TEST_PASSWORD,
} from "./helpers";

const HOUR = 3600_000;
const cookieFrom = (res: { headers: Record<string, unknown> }) =>
  (res.headers["set-cookie"] as unknown as string[])[0].split(";")[0];

async function until(check: () => Promise<boolean> | boolean) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}

export function highValueTests() {
  describe("high-value additions", () => {
    beforeEach(resetDatabase);

    it("alerts the recipient once about a message left unread for 15 minutes", async () => {
      const { shop, owner } = await createShop();
      const client = await createUser();
      const conversation = await AppDataSource.getRepository(Conversation).save({ client, shop });
      const messages = AppDataSource.getRepository(Message);
      const old = new Date(Date.now() - 20 * 60_000);
      await messages.save([
        { conversation, sender: client, content: "Is the oak stool still available?", createdAt: old },
        { conversation, sender: client, content: "And do you deliver?", createdAt: old },
      ]);
      await AppDataSource.query(`UPDATE messages SET "createdAt" = $1`, [old]);
      await messages.save({ conversation, sender: client, content: "just now" }); // too recent

      assert.equal(await notifyUnreadMessages(), 1, "one alert for the conversation");
      await notificationsSettled();
      const mail = sentEmails.find((e) => e.to === owner.email);
      assert.ok(mail && /New message from/.test(mail.subject));
      assert.match(mail!.html, /and 1 more/);
      assert.equal(await notifyUnreadMessages(), 0, "never twice");
    });

    it("enforces each shop's minimum notice", async () => {
      const { shop, owner } = await createShop();
      const service = await createService(shop);
      await api().put("/api/shops/mine/hours").set("Cookie", authCookie(owner))
        .send({ timezone: "UTC", openingHours: null, bookingMinNoticeHours: 24 }).expect(200);
      const cookie = authCookie(await createUser());
      const soon = await api().post("/api/bookings").set("Cookie", cookie)
        .send({ serviceId: service.id, scheduledAt: new Date(Date.now() + 3 * HOUR).toISOString() });
      assert.equal(soon.status, 400);
      assert.match(soon.body.message, /24 hours' notice/);
      const later = await api().post("/api/bookings").set("Cookie", cookie)
        .send({ serviceId: service.id, scheduledAt: new Date(Date.now() + 30 * HOUR).toISOString() });
      assert.equal(later.status, 201, JSON.stringify(later.body));
    });

    it("sends day-before reminders once, and completes past appointments with a review prompt", async () => {
      const { shop } = await createShop();
      const service = await createService(shop);
      const client = await createUser();
      const bookings = AppDataSource.getRepository(Booking);
      const base = { client, shop, service, totalAmount: 40, status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID };
      const tomorrow = await bookings.save({ ...base, scheduledAt: new Date(Date.now() + 20 * HOUR) });
      const past = await bookings.save({ ...base, scheduledAt: new Date(Date.now() - 50 * HOUR), endsAt: new Date(Date.now() - 49 * HOUR) });
      await AppDataSource.query(`UPDATE bookings SET "createdAt" = now() - interval '3 days'`);

      assert.equal(await sendBookingReminders(), 1);
      assert.equal(await sendBookingReminders(), 0, "only once");
      assert.equal(await autoCompleteBookings(), 1);
      await notificationsSettled();

      assert.ok((await bookings.findOneByOrFail({ id: tomorrow.id })).reminderSentAt);
      assert.equal((await bookings.findOneByOrFail({ id: past.id })).status, "completed");
      assert.ok(sentEmails.some((e) => e.to === client.email && /Reminder/.test(e.subject)));
      assert.ok(sentEmails.some((e) => e.to === client.email && /How was/.test(e.subject)));
    });

    it("asks Stripe to email the client a receipt", async () => {
      const { shop } = await createShop();
      const product = await createProduct(shop);
      const client = await createUser();
      await api().post("/api/orders").set("Cookie", authCookie(client)).send({ productId: product.id, quantity: 1 }).expect(201);
      assert.equal(fakeStripe.latestIntent()!.receipt_email, client.email);
    });

    it("keeps shops' payout status in step with Stripe in the background", async () => {
      const { shop } = await createShop(undefined, { stripeOnboardingComplete: true });
      fakeStripe.restrictedAccounts.add(shop.stripeAccountId!);
      assert.equal(await refreshAllStripeStatuses(), 1);
      const reloaded = await AppDataSource.getRepository(Shop).findOneByOrFail({ id: shop.id });
      assert.equal(reloaded.stripeOnboardingComplete, false);
    });

    it("lets the client confirm a delivery arrived", async () => {
      const { shop, owner } = await createShop();
      const product = await createProduct(shop);
      const client = await createUser();
      const orders = AppDataSource.getRepository(Order);
      const make = (deliveryMethod: DeliveryMethod) => orders.save(orders.create({
        client, shop, product, productId: product.id, quantity: 1, totalAmount: 25,
        status: OrderStatus.FULFILLED, paymentStatus: OrderPaymentStatus.PAID, deliveryMethod,
      }));
      const delivery = await make(DeliveryMethod.DELIVERY);
      const pickup = await make(DeliveryMethod.PICKUP);

      const stranger = await api().patch(`/api/orders/${delivery.id}/received`).set("Cookie", authCookie(await createUser()));
      assert.equal(stranger.status, 403);
      assert.equal((await api().patch(`/api/orders/${pickup.id}/received`).set("Cookie", authCookie(client))).status, 400);
      const ok = await api().patch(`/api/orders/${delivery.id}/received`).set("Cookie", authCookie(client));
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      assert.ok(ok.body.deliveredAt);
      await notificationsSettled();
      assert.ok(sentEmails.some((e) => e.to === owner.email && /Delivered/.test(e.subject)));
    });

    it("signs out every session with 'sign out of all devices'", async () => {
      const user = await createUser();
      const login = await api().post("/api/auth/login").send({ email: user.email, password: TEST_PASSWORD });
      const other = cookieFrom(login);
      // Tokens are compared in whole seconds — make sure the old one is older.
      await new Promise((r) => setTimeout(r, 1100));
      await api().post("/api/auth/logout-all").set("Cookie", authCookie(user)).expect(200);
      assert.equal((await api().get("/api/auth/me").set("Cookie", other)).status, 401);

      const again = await api().post("/api/auth/login").send({ email: user.email, password: TEST_PASSWORD });
      assert.equal((await api().get("/api/auth/me").set("Cookie", cookieFrom(again))).status, 200, "signing in again works");
    });

    it("runs two-step login end to end, with single-use recovery codes", async () => {
      const user = await createUser(UserRole.SUPER_ADMIN);
      const cookie = authCookie(user);
      const setup = await api().post("/api/auth/2fa/setup").set("Cookie", cookie);
      assert.equal(setup.status, 200);
      assert.match(setup.body.otpauthUrl, /^otpauth:\/\/totp\//);
      assert.equal((await api().post("/api/auth/2fa/enable").set("Cookie", cookie).send({ code: "000000" })).status, 400);
      const enabled = await api().post("/api/auth/2fa/enable").set("Cookie", cookie).send({ code: totpCode(setup.body.secret) });
      assert.equal(enabled.status, 200, JSON.stringify(enabled.body));
      assert.equal(enabled.body.recoveryCodes.length, 8);

      const step1 = await api().post("/api/auth/login").send({ email: user.email, password: TEST_PASSWORD });
      assert.equal(step1.body.twoFactorRequired, true);
      assert.equal(step1.headers["set-cookie"], undefined, "no session before the second step");
      assert.equal((await api().get("/api/auth/me").set("Cookie", `token=${step1.body.challenge}`)).status, 401, "the challenge isn't a session");

      const wrong = await api().post("/api/auth/login/2fa").send({ challenge: step1.body.challenge, code: "123456" });
      assert.equal(wrong.status, 401);
      const step2 = await api().post("/api/auth/login/2fa").send({ challenge: step1.body.challenge, code: totpCode(setup.body.secret) });
      assert.equal(step2.status, 200);
      assert.equal(step2.body.user.twoFactorEnabled, true);

      const recovery = enabled.body.recoveryCodes[0];
      const viaRecovery = await api().post("/api/auth/login/2fa").send({ challenge: step1.body.challenge, code: recovery });
      assert.equal(viaRecovery.status, 200);
      const reused = await api().post("/api/auth/login/2fa").send({ challenge: step1.body.challenge, code: recovery });
      assert.equal(reused.status, 401, "a recovery code works once");

      const noPassword = await api().post("/api/auth/2fa/disable").set("Cookie", cookie).send({ password: "wrong", code: totpCode(setup.body.secret) });
      assert.equal(noPassword.status, 400);
      await api().post("/api/auth/2fa/disable").set("Cookie", cookie).send({ password: TEST_PASSWORD, code: totpCode(setup.body.secret) }).expect(200);
      const plain = await api().post("/api/auth/login").send({ email: user.email, password: TEST_PASSWORD });
      assert.ok(plain.body.user, "plain login again once it's off");
    });

    it("logs admins' changes, not artisans'", async () => {
      const admin = await createUser(UserRole.SUPER_ADMIN);
      const { shop, owner } = await createShop();
      const service = await createService(shop);
      await api().patch(`/api/shops/${shop.id}/status`).set("Cookie", authCookie(admin)).send({ status: "suspended" }).expect(200);
      await api().put(`/api/services/${service.id}`).set("Cookie", authCookie(owner as User)).send({ name: "Renamed" });

      const repo = AppDataSource.getRepository(AdminAction);
      assert.ok(await until(async () => (await repo.count()) === 1));
      const log = await api().get("/api/audit").set("Cookie", authCookie(admin));
      assert.equal(log.status, 200);
      assert.equal(log.body.data.length, 1);
      assert.equal(log.body.data[0].action, "shop.status_changed");
      assert.equal(log.body.data[0].targetId, shop.id);
      assert.equal(log.body.data[0].admin.name, admin.name);
      assert.match(log.body.data[0].summary, /status=suspended/);
      assert.equal((await api().get("/api/audit").set("Cookie", authCookie(owner))).status, 403);
    });
  });
}
