import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppDataSource } from "../src/data-source";
import { User, UserRole } from "../src/modules/users/entities/user.entities";
import { api, authCookie, createUser, resetDatabase, TEST_PASSWORD } from "./helpers";

const validSignup = {
  name: "Ada Lovelace",
  email: "Ada@Example.test",
  password: "a-long-enough-password",
  phone: "+15551234567",
  role: "client",
  acceptTerms: true,
};

function cookieHeader(res: { headers: Record<string, unknown> }) {
  const raw = res.headers["set-cookie"];
  return (Array.isArray(raw) ? raw : raw ? [String(raw)] : []).join("; ");
}

export function authTests() {
  describe("auth", () => {
    beforeEach(resetDatabase);

    it("registers, logs the new user in, and never returns the password", async () => {
      const res = await api().post("/api/auth/register").send(validSignup);
      assert.equal(res.status, 201);
      assert.match(cookieHeader(res), /token=/);
      assert.equal(res.body.user.email, "ada@example.test", "email is stored lowercased");
      assert.equal(res.body.user.password, undefined);

      const me = await api()
        .get("/api/auth/me")
        .set("Cookie", cookieHeader(res).split(";")[0]);
      assert.equal(me.status, 200);
      assert.equal(me.body.name, "Ada Lovelace");
      assert.equal(me.body.password, undefined);
    });

    it("rejects a second account with the same email in a different case", async () => {
      await api().post("/api/auth/register").send(validSignup).expect(201);
      const res = await api()
        .post("/api/auth/register")
        .send({ ...validSignup, email: "ADA@example.TEST", phone: "+15559999999" });
      assert.equal(res.status, 409);
    });

    it("refuses sign-up as an admin and without accepting the terms", async () => {
      const admin = await api()
        .post("/api/auth/register")
        .send({ ...validSignup, role: "super_admin" });
      assert.equal(admin.status, 400);
      assert.equal(admin.body.field, "role");

      const noTerms = await api()
        .post("/api/auth/register")
        .send({ ...validSignup, acceptTerms: false });
      assert.equal(noTerms.status, 400);
      assert.equal(noTerms.body.field, "acceptTerms");
    });

    it("logs in with the right password only", async () => {
      const user = await createUser(UserRole.CLIENT);

      const wrong = await api()
        .post("/api/auth/login")
        .send({ email: user.email, password: "not-the-password" });
      assert.equal(wrong.status, 401);
      assert.doesNotMatch(cookieHeader(wrong), /token=[^;]/);

      const right = await api()
        .post("/api/auth/login")
        .send({ email: user.email.toUpperCase(), password: TEST_PASSWORD });
      assert.equal(right.status, 200);
      assert.match(cookieHeader(right), /token=[^;]/);
    });

    it("answers 401 without a session and clears a dead cookie", async () => {
      const none = await api().get("/api/auth/me");
      assert.equal(none.status, 401);

      const forged = await api().get("/api/auth/me").set("Cookie", "token=not-a-jwt");
      assert.equal(forged.status, 401);
      assert.match(cookieHeader(forged), /token=;/, "the bad cookie is cleared");
    });

    it("locks out a suspended account even with a valid token", async () => {
      const user = await createUser(UserRole.CLIENT);
      const cookie = authCookie(user);
      await AppDataSource.getRepository(User).update(user.id, { isActive: false });

      const res = await api().get("/api/auth/me").set("Cookie", cookie);
      assert.equal(res.status, 403);
    });

    it("takes the role from the database, not the token", async () => {
      const user = await createUser(UserRole.CLIENT);
      // A token claiming admin, signed with the real secret.
      const cookie = authCookie({ ...user, role: UserRole.SUPER_ADMIN });

      const res = await api().get("/api/orders/admin/all").set("Cookie", cookie);
      assert.equal(res.status, 403);
    });
  });
}
