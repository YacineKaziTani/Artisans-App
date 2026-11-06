# Artisans API

Express 5 + TypeORM (Postgres) + Stripe + Socket.io.

## Running locally

```bash
cp .env.example .env   # then fill it in
npm install
npm run dev            # http://localhost:3000
```

Pending migrations are applied automatically when the server starts.

For a local Postgres without TLS, set `DB_SSL=false`.

## Database migrations

The schema comes from `src/migrations`. Never from `synchronize`, unless `DB_SYNC=true` is set on a throwaway database.

After changing an entity:

```bash
npm run migration:generate -- src/migrations/DescribeTheChange
```

Read the generated file before committing it. TypeORM turns some changes, such as a column type change, into DROP + ADD, which loses data. Rewrite those as `ALTER COLUMN … TYPE … USING …`.

`npm run migration:check` exits non-zero if the entities and the migrations disagree. CI runs it on every push.

## Tests

The integration tests run the real app against a real Postgres. The schema is built by the migrations. Stripe and email are replaced with in-memory fakes, so nothing leaves your machine.

```bash
npm run test:tempdb
```

This creates a throwaway `artisans_test_<timestamp>` database on the server in `DATABASE_URL` (or `TEST_DB_SERVER_URL`), runs the tests against it, and always drops it afterwards. The database named in `DATABASE_URL` is never written to.

To use a database you manage yourself:

```bash
TEST_DATABASE_URL=postgres://…/artisans_test npm test
```

The tests empty every table, so they refuse to run unless the database name contains `test`. They also never read `.env`.

Tests live in `test/`; `test/run.ts` lists the suites. Use the fakes in `test/helpers.ts`:

- `fakeStripe.authorize(intentId)` simulates the client confirming their card.
- `sendWebhook(type, intent)` delivers a Stripe event to the webhook route.

## Deploying (Render)

- **Health check path:** `/healthz`. It returns 503 when the database is unreachable.
- **Shutdown:** on SIGTERM the server stops taking requests, finishes the ones in flight, stops the checkout expiry job and closes the database pool.
- **Stripe webhook events:** `payment_intent.amount_capturable_updated`, `payment_intent.succeeded`, `payment_intent.payment_failed` and `payment_intent.canceled`.
- **Scaling past one instance:** see the note at the top of `src/middleware/rate-limit.middleware.ts`. Rate limits and Socket.io need a shared Redis.
