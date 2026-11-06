import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { UserRole } from "../src/modules/users/entities/user.entities";
import { api, createUser, resetDatabase, sentEmails } from "./helpers";

const message = {
  name: "Sam",
  email: "sam@example.test",
  topic: "order",
  message: "My parcel hasn't arrived yet, can you help?",
};

export function supportTests() {
  describe("help center contact form", () => {
    beforeEach(resetDatabase);

    it("emails the admins, with replies going to the visitor", async () => {
      const admin = await createUser(UserRole.SUPER_ADMIN);
      const res = await api().post("/api/support/contact").send(message);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const sent = sentEmails.find((e) => e.to === admin.email);
      assert.ok(sent, "an admin got the message");
      assert.equal(sent!.replyTo, "sam@example.test");
      assert.match(sent!.html, /parcel hasn&#39;t arrived|parcel hasn't arrived/);
    });

    it("quietly drops bot submissions and rejects incomplete ones", async () => {
      await createUser(UserRole.SUPER_ADMIN);
      const bot = await api().post("/api/support/contact").send({ ...message, website: "http://spam.example" });
      assert.equal(bot.status, 200);
      assert.equal(sentEmails.length, 0, "the honeypot sends nothing");

      const short = await api().post("/api/support/contact").send({ ...message, message: "hi" });
      assert.equal(short.status, 400);
      assert.equal(short.body.field, "message");
    });
  });
}
