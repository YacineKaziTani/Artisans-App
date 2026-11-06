import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { UserRole } from "../src/modules/users/entities/user.entities";
import { closeSocketServer, initSocketServer } from "../src/realtime/socket";
import { stripe } from "../src/config/stripe";
import { api, app, authCookie, createUser, fakeStripe, resetDatabase, sendWebhook } from "./helpers";

const OUR_SITE = "http://localhost:5173"; // FRONTEND_URL in test/env.ts
const EVIL_SITE = "https://evil.example";

export function securityTests() {
  describe("cross-site request protection", () => {
    beforeEach(resetDatabase);

    it("refuses a change requested from another website, even with a valid session", async () => {
      const user = await createUser(UserRole.CLIENT);
      const res = await api()
        .patch("/api/users/mine")
        .set("Cookie", authCookie(user))
        .set("Origin", EVIL_SITE)
        .send({ name: "Hacked" });
      assert.equal(res.status, 403);

      const me = await api().get("/api/auth/me").set("Cookie", authCookie(user));
      assert.equal(me.body.name, user.name, "nothing changed");
    });

    it("refuses the 'null' origin that sandboxed frames send", async () => {
      const res = await api().post("/api/auth/logout").set("Origin", "null");
      assert.equal(res.status, 403);
    });

    it("lets our own frontend, non-browser clients and plain reads through", async () => {
      const user = await createUser(UserRole.CLIENT);
      const fromUs = await api()
        .patch("/api/users/mine")
        .set("Cookie", authCookie(user))
        .set("Origin", OUR_SITE)
        .send({ name: "Renamed" });
      assert.equal(fromUs.status, 200, JSON.stringify(fromUs.body));

      const noOrigin = await api().post("/api/auth/logout");
      assert.equal(noOrigin.status, 200);

      const read = await api().get("/api/categories").set("Origin", EVIL_SITE);
      assert.equal(read.status, 200);
    });

    it("doesn't block Stripe's webhook (no Origin, authenticated by signature)", async () => {
      // An intent for the event to carry; no order needs to exist for it.
      const created = await stripe.paymentIntents.create({ amount: 100, currency: "usd" });
      const intent = fakeStripe.authorize(created.id);
      const res = await sendWebhook("payment_intent.amount_capturable_updated", intent);
      assert.equal(res.status, 200);
    });
  });

  describe("live chat socket", () => {
    let server: Server;
    let base: string;

    before(async () => {
      server = createServer(app);
      initSocketServer(server);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      base = `http://localhost:${(server.address() as AddressInfo).port}`;
    });

    after(async () => {
      await closeSocketServer(); // also closes `server`
    });

    const handshake = (origin?: string) =>
      fetch(`${base}/socket.io/?EIO=4&transport=polling`, {
        headers: origin ? { Origin: origin } : {},
      });

    it("refuses connections opened by another website", async () => {
      const res = await handshake(EVIL_SITE);
      assert.equal(res.status, 403);
    });

    it("accepts connections from our frontend", async () => {
      const res = await handshake(OUR_SITE);
      assert.equal(res.status, 200);
      assert.match(await res.text(), /"sid"/);
    });
  });
}
