import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { UserRole } from "../src/modules/users/entities/user.entities";
import { api, authCookie, createUser, resetDatabase, sentEmails } from "./helpers";

async function waitForEmail(to: string) {
  for (let i = 0; i < 100; i++) {
    const email = sentEmails.find((e) => e.to === to);
    if (email) return email;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`no email to ${to}`);
}

let n = 0;
const signUp = (extra: object) =>
  api().post("/api/auth/register").send({
    name: "Friend",
    email: `friend${++n}@example.test`,
    password: "a-long-enough-password",
    phone: `+1777000${String(n).padStart(4, "0")}`,
    role: "client",
    acceptTerms: true,
    ...extra,
  });

export function growthTests() {
  describe("referrals and newsletter", () => {
    beforeEach(resetDatabase);

    it("counts people who sign up with your invite code", async () => {
      const inviter = await createUser(UserRole.ARTISAN);
      const cookie = authCookie(inviter);
      const mine = await api().get("/api/users/mine/referrals").set("Cookie", cookie);
      assert.equal(mine.status, 200);
      assert.match(mine.body.code, /^[A-Z2-9]{8}$/);
      assert.equal(mine.body.joined, 0);

      await signUp({ ref: mine.body.code.toLowerCase() }).expect(201); // codes are case-insensitive
      await signUp({ ref: mine.body.code, role: "artisan" }).expect(201);
      await signUp({ ref: "NOSUCHCODE" }).expect(201); // unknown codes are ignored

      const after = await api().get("/api/users/mine/referrals").set("Cookie", cookie);
      assert.equal(after.body.code, mine.body.code, "the code is stable");
      assert.equal(after.body.joined, 2);
      assert.equal(after.body.artisans, 1);
    });

    it("subscribes only after the emailed link is clicked, and unsubscribes in one click", async () => {
      const admin = authCookie(await createUser(UserRole.SUPER_ADMIN));
      const res = await api().post("/api/newsletter/subscribe").send({ email: "Fan@Example.test" });
      assert.equal(res.status, 200);

      const stats = async () => (await api().get("/api/newsletter/admin/stats").set("Cookie", admin)).body;
      assert.deepEqual(await stats(), { subscribed: 0, pending: 1 });

      const email = await waitForEmail("fan@example.test");
      const token = email.html.match(/confirm=([0-9a-f]{64})/)?.[1];
      assert.ok(token, "the confirmation email has a link");
      await api().post("/api/newsletter/confirm").send({ token }).expect(200);
      assert.deepEqual(await stats(), { subscribed: 1, pending: 0 });

      const csv = await api().get("/api/newsletter/admin/export").set("Cookie", admin);
      assert.equal(csv.status, 200);
      assert.match(csv.headers["content-type"], /text\/csv/);
      assert.match(csv.text, /"fan@example\.test"/);
      assert.match(csv.text, new RegExp(`unsubscribe=${token}`));

      await api().post("/api/newsletter/unsubscribe").send({ token }).expect(200);
      assert.deepEqual(await stats(), { subscribed: 0, pending: 0 });

      const nonAdmin = await api().get("/api/newsletter/admin/export").set("Cookie", authCookie(await createUser()));
      assert.equal(nonAdmin.status, 403);
    });
  });
}

export function metricsTests() {
  describe("admin metrics", () => {
    beforeEach(resetDatabase);

    it("sums captured sales and commission for the window, admins only", async () => {
      const { AppDataSource } = await import("../src/data-source");
      const { Order, OrderPaymentStatus, OrderStatus } = await import("../src/modules/orders/order.entities");
      const { createShop, createProduct } = await import("./helpers");
      const { shop } = await createShop();
      const product = await createProduct(shop);
      const client = await createUser();
      const orders = AppDataSource.getRepository(Order);
      const order = (paymentStatus: (typeof OrderPaymentStatus)[keyof typeof OrderPaymentStatus], total: number) =>
        orders.save(orders.create({
          client, shop, product, productId: product.id, quantity: 1, totalAmount: total,
          status: OrderStatus.FULFILLED, paymentStatus,
        }));
      await order(OrderPaymentStatus.PAID, 100);
      await order(OrderPaymentStatus.PAID, 50.5);
      await order(OrderPaymentStatus.AUTHORIZED, 999); // not captured — not counted

      const admin = authCookie(await createUser(UserRole.SUPER_ADMIN));
      const res = await api().get("/api/metrics/admin?days=30").set("Cookie", admin);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.current.sales, 2);
      assert.equal(res.body.current.volume, 150.5);
      assert.equal(res.body.current.commission, 15.05);
      assert.equal(res.body.previous.sales, 0);
      assert.equal(res.body.shops.active, 1);
      assert.ok(res.body.current.newClients >= 1);

      const denied = await api().get("/api/metrics/admin").set("Cookie", authCookie(client));
      assert.equal(denied.status, 403);
    });
  });
}
