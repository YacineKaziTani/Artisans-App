/**
 * New accounts must confirm their email before ordering, booking,
 * messaging or posting. On by default.
 *
 * Set REQUIRE_EMAIL_VERIFICATION=false only while email delivery isn't
 * working yet (e.g. Resend's sandbox sender, which only reaches your own
 * inbox) — otherwise new users could never confirm, and so never buy.
 */
export const emailVerificationRequired =
  process.env.REQUIRE_EMAIL_VERIFICATION !== "false";

/** How long a confirmation link stays valid. */
export const EMAIL_VERIFICATION_TTL_MS = 48 * 60 * 60 * 1000;
