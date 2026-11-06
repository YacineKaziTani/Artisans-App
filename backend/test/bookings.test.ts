import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppDataSource } from "../src/data-source";
import { UserRole } from "../src/modules/users/entities/user.entities";
import { Booking } from "../src/modules/booking/booking.entities";
import {
  api,
  authCookie,
  createService,
  createShop,
  createUser,
  fakeStripe,
  resetDatabase,
  sendWebhook,
} from "./helpers";

const HOUR = 60 * 60 * 1000;
/** A whole hour, two days out, so tests don't depend on the clock. */
const slot = (offsetMinutes = 0) => {
  const base = new Date(Date.now() + 48 * HOUR);
  base.setUTCMinutes(0, 0, 0);
  return new Date(base.getTime() + offsetMinutes * 60 * 1000).toISOString();
};

async function setup() {
  const { shop, owner } = await createShop();
  const service = await createService(shop, { price: 40, durationMinutes: 60 });
  const client = await createUser(UserRole.CLIENT);
  return { shop, owner, service, client, cookie: authCookie(client) };
}

export function bookingTests() {
  describe("bookings", () => {
    beforeEach(resetDatabase);

    it("holds the service price and refuses an overlapping slot", async () => {
      const { service, cookie } = await setup();

      const first = await api()
        .post("/api/bookings")
        .set("Cookie", cookie)
        .send({ serviceId: service.id, scheduledAt: slot() });
      assert.equal(first.status, 201, JSON.stringify(first.body));
      assert.equal(fakeStripe.latestIntent()!.amount, 4000);

      const other = authCookie(await createUser());
      const overlapping = await api()
        .post("/api/bookings")
        .set("Cookie", other)
        .send({ serviceId: service.id, scheduledAt: slot(30) });
      assert.equal(overlapping.status, 409);

      const afterIt = await api()
        .post("/api/bookings")
        .set("Cookie", other)
        .send({ serviceId: service.id, scheduledAt: slot(60) });
      assert.equal(afterIt.status, 201, "a slot starting when the last one ends is free");
    });

    it("gives exactly one of two simultaneous requests the same slot", async () => {
      const { service } = await setup();
      const [a, b] = await Promise.all([createUser(), createUser()]);

      const results = await Promise.all(
        [a, b].map((user) =>
          api()
            .post("/api/bookings")
            .set("Cookie", authCookie(user))
            .send({ serviceId: service.id, scheduledAt: slot() }),
        ),
      );
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    });

    it("frees the slot when the client abandons the payment step", async () => {
      const { service, cookie } = await setup();
      const created = await api()
        .post("/api/bookings")
        .set("Cookie", cookie)
        .send({ serviceId: service.id, scheduledAt: slot() });

      const abandon = await api()
        .post(`/api/bookings/${created.body.booking.id}/abandon`)
        .set("Cookie", cookie);
      assert.equal(abandon.status, 200, JSON.stringify(abandon.body));

      const again = await api()
        .post("/api/bookings")
        .set("Cookie", authCookie(await createUser()))
        .send({ serviceId: service.id, scheduledAt: slot() });
      assert.equal(again.status, 201);
    });

    it("refuses bookings in the past and on your own shop", async () => {
      const { service, owner, cookie } = await setup();

      const past = await api()
        .post("/api/bookings")
        .set("Cookie", cookie)
        .send({ serviceId: service.id, scheduledAt: new Date(Date.now() - HOUR).toISOString() });
      assert.equal(past.status, 400);

      const own = await api()
        .post("/api/bookings")
        .set("Cookie", authCookie(owner))
        .send({ serviceId: service.id, scheduledAt: slot() });
      assert.equal(own.status, 400);
      assert.equal(fakeStripe.intents.size, 0);
    });

    it("captures the hold when the artisan confirms", async () => {
      const { service, owner, cookie } = await setup();
      const created = await api()
        .post("/api/bookings")
        .set("Cookie", cookie)
        .send({ serviceId: service.id, scheduledAt: slot() });
      const intent = fakeStripe.authorize(fakeStripe.latestIntent()!.id);
      await sendWebhook("payment_intent.amount_capturable_updated", intent).expect(200);

      const confirm = await api()
        .patch(`/api/bookings/${created.body.booking.id}/status`)
        .set("Cookie", authCookie(owner))
        .send({ status: "confirmed" });
      assert.equal(confirm.status, 200, JSON.stringify(confirm.body));
      assert.equal(intent.status, "succeeded");

      const booking = await AppDataSource.getRepository(Booking).findOneByOrFail({
        id: created.body.booking.id,
      });
      assert.equal(booking.status, "confirmed");
      assert.equal(booking.paymentStatus, "paid");

      // Completing it before the appointment time isn't allowed.
      const early = await api()
        .patch(`/api/bookings/${booking.id}/status`)
        .set("Cookie", authCookie(owner))
        .send({ status: "completed" });
      assert.equal(early.status, 400);
    });
  });
}
