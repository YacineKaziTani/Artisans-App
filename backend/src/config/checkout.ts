import { Raw } from "typeorm";

// Creating an order reserves stock and creating a booking holds a time slot,
// both before the client has paid. If they never authorize payment, the
// reservation is released once it's this old — or straight away when they
// back out of the payment step.
export const CHECKOUT_TTL_MINUTES = Math.max(
  5,
  Math.floor(Number(process.env.CHECKOUT_TTL_MINUTES) || 30),
);

// The createdAt columns are `timestamp without time zone` filled by now(), so
// the cutoff has to be computed by the database too. A JS Date parameter is
// sent with the Node process's UTC offset, which Postgres silently drops for
// this column type — on a machine ahead of UTC that would make brand-new
// checkouts look expired.
const ttl = `interval '${CHECKOUT_TTL_MINUTES} minutes'`;

/** SQL for "within the checkout TTL", for hand-written query builder conditions. */
export const withinCheckoutTtlSql = (column: string) =>
  `${column} >= now() - ${ttl}`;

/** Find operator: created longer ago than the checkout TTL. */
export const createdBeforeCheckoutTtl = () =>
  Raw((column) => `${column} < now() - ${ttl}`);
