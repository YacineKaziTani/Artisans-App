/** Postgres unique_violation — a race lost against a UNIQUE constraint. */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; driverError?: { code?: string } } | null;
  return e?.code === "23505" || e?.driverError?.code === "23505";
}
