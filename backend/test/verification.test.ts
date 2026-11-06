import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppDataSource } from "../src/data-source";
import { User } from "../src/modules/users/entities/user.entities";
import {
  api,
  createProduct,
  createShop,
  resetDatabase,
  tokenFromEmail,
} from "./helpers";

let phoneSeq = 0;

/** Signs up through the API (so the account starts unconfirmed). */
async function signUp(email = `new${++phoneSeq}@example.test`) {
  const res = await api()
    .post("/api/auth/register")
    .send({
      name: "New Person",
      email,
      password: "a-long-enough-password",
      phone: `+1666000${String(phoneSeq).padStart(4, "0")}`,
      role: "client",
      acceptTerms: true,
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const raw = res.headers["set-cookie"] as unknown as string[];
  return { email, cookie: raw[0].split(";")[0], user: res.body.user };
}

const VERIFY_SUBJECT = /confirm your email/i;

export function verificationTests() {
  describe("email confirmation", () => {
    beforeEach(resetDatabase);

    it("lets a new account browse, but not buy until the email is confirmed", async () => {
      const { shop } = await createShop();
      const product = await createProduct(shop, { stockQuantity: 5 });
      const { email, cookie, user } = await signUp();
      assert.equal(user.emailVerified, false);

      const blocked = await api()
        .post("/api/orders")
        .set("Cookie", cookie)
        .send({ productId: product.id, quantity: 1 });
      assert.equal(blocked.status, 403);
      assert.equal(blocked.body.code, "EMAIL_NOT_VERIFIED");

      assert.equal((await api().get("/api/products").set("Cookie", cookie)).status, 200);

      const token = await tokenFromEmail(email, VERIFY_SUBJECT);
      const verified = await api().post("/api/auth/verify-email").send({ token });
      assert.equal(verified.status, 200, JSON.stringify(verified.body));

      const me = await api().get("/api/auth/me").set("Cookie", cookie);
      assert.equal(me.body.emailVerified, true);

      const allowed = await api()
        .post("/api/orders")
        .set("Cookie", cookie)
        .send({ productId: product.id, quantity: 1 });
      assert.equal(allowed.status, 201, JSON.stringify(allowed.body));
    });

    it("blocks the other actions that reach people: booking, messaging, reviews, reports, shops", async () => {
      const { shop } = await createShop();
      const { cookie } = await signUp();
      const uuid = "00000000-0000-4000-8000-000000000000";
      const attempts: [string, object][] = [
        ["/api/bookings", { serviceId: uuid, scheduledAt: new Date(Date.now() + 864e5).toISOString() }],
        ["/api/conversations", { shopId: shop.id, content: "hi" }],
        [`/api/reviews/shop/${shop.id}`, { rating: 5 }],
        ["/api/reports", { targetType: "shop", targetId: shop.id, reason: "a long enough reason here" }],
        ["/api/disputes", { targetType: "order", targetId: uuid, reason: "a long enough reason here" }],
        ["/api/shops/create", { shopName: "Mine" }],
      ];
      for (const [path, body] of attempts) {
        const res = await api().post(path).set("Cookie", cookie).send(body);
        assert.equal(res.status, 403, `POST ${path} → ${res.status}`);
        assert.equal(res.body.code, "EMAIL_NOT_VERIFIED");
      }
    });

    it("makes each link single-use and refuses expired ones", async () => {
      const { email } = await signUp();
      const token = await tokenFromEmail(email, VERIFY_SUBJECT);

      await api().post("/api/auth/verify-email").send({ token }).expect(200);
      const reused = await api().post("/api/auth/verify-email").send({ token });
      assert.equal(reused.status, 400);

      const second = await signUp();
      const secondToken = await tokenFromEmail(second.email, VERIFY_SUBJECT);
      await AppDataSource.getRepository(User).update(
        { email: second.email },
        { emailVerificationExpiresAt: new Date(Date.now() - 1000) },
      );
      const expired = await api().post("/api/auth/verify-email").send({ token: secondToken });
      assert.equal(expired.status, 400);
      assert.match(expired.body.message, /expired/);

      const malformed = await api().post("/api/auth/verify-email").send({ token: "abc" });
      assert.equal(malformed.status, 400);
      assert.equal(malformed.body.field, "token");
    });

    it("sends a new link on request, and the old one stops working", async () => {
      const { email, cookie } = await signUp();
      const first = await tokenFromEmail(email, VERIFY_SUBJECT);

      const resend = await api().post("/api/auth/resend-verification").set("Cookie", cookie);
      assert.equal(resend.status, 200);
      let second = first;
      for (let i = 0; i < 100 && second === first; i++) {
        second = await tokenFromEmail(email, VERIFY_SUBJECT);
        if (second === first) await new Promise((r) => setTimeout(r, 20));
      }
      assert.notEqual(second, first);

      assert.equal((await api().post("/api/auth/verify-email").send({ token: first })).status, 400);
      assert.equal((await api().post("/api/auth/verify-email").send({ token: second })).status, 200);

      const again = await api().post("/api/auth/resend-verification").set("Cookie", cookie);
      assert.equal(again.body.alreadyVerified, true);
    });

    it("counts a completed password reset as confirmation (the link reached their inbox)", async () => {
      const { email, cookie } = await signUp();
      await api().post("/api/auth/forgot-password").send({ email }).expect(200);
      const token = await tokenFromEmail(email, /reset your password/i);

      const reset = await api()
        .post("/api/auth/reset-password")
        .send({ email, token, newPassword: "another-long-password" });
      assert.equal(reset.status, 200, JSON.stringify(reset.body));

      const login = await api()
        .post("/api/auth/login")
        .send({ email, password: "another-long-password" });
      assert.equal(login.body.user.emailVerified, true);
      // The old session was signed out by the password change.
      assert.equal((await api().get("/api/auth/me").set("Cookie", cookie)).status, 401);
    });
  });
}
