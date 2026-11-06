import crypto from "crypto";

// No 0/O, 1/I/L: codes get read aloud and typed in by hand.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** An 8-character invite code, e.g. "K7QM2XWP". */
export function newReferralCode(length = 8) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
