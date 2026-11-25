import { LIMITS } from "../../../shared/constants.js";

/** Requests each expected guest may need within one rate-limit window, per action. */
export const PER_GUEST = {
  event: 3,
  submit: 1,
  "email-send": 1,
  "email-confirm": 2,
  report: 1,
  captcha: 2,
} as const;

/**
 * Per-book (and per-venue-IP) limit for a guest action. Everyone at one event may arrive
 * in the same minute on the same Wi-Fi, so the ceiling grows with the host's guest count
 * and never drops below the configured base.
 */
export function scaledGuestLimit(
  base: number,
  expectedGuests: number | null | undefined,
  perGuest: number,
) {
  const guests = Math.min(
    LIMITS.expectedGuestsMax,
    Math.max(LIMITS.expectedGuestsMin, Math.floor(expectedGuests ?? LIMITS.expectedGuestsDefault)),
  );
  return Math.max(base, Math.ceil(guests * perGuest));
}
