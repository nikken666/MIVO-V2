import type { Key, Translate } from "./index";

// Turns errors from Supabase, Stripe or the browser into a short message in
// the shopper's language. Technical database text is never shown as is.

const patterns: Array<[RegExp, Key]> = [
  [/could not find the function|schema cache|function .* does not exist|relation .* does not exist/i, "errors.notReady"],
  [/failed to fetch|networkerror|load failed|network request failed|err_internet/i, "errors.network"],
  [/invalid login credentials|invalid email or password/i, "errors.badLogin"],
  [/email not confirmed/i, "errors.emailNotConfirmed"],
  [/user already registered|already been registered|email.*already.*(exists|use)/i, "errors.alreadyRegistered"],
  [/password should be at least|password.*(too short|at least \d+)/i, "errors.passwordShort"],
  [/for security purposes|rate limit|too many requests|429/i, "errors.tooMany"],
  [/jwt expired|refresh token|not authenticated|auth session missing|please sign in|sign in (first|before)/i, "errors.signIn"],
  [/card (was )?declined|card_declined|do_not_honor/i, "errors.cardDeclined"],
  [/insufficient[_ ]funds/i, "errors.insufficientFunds"],
  [/expired[_ ]card|card has expired/i, "errors.cardExpired"],
  [/incorrect[_ ](cvc|number)|invalid (card )?number/i, "errors.cardDetails"],
  [/out of stock|insufficient stock|not enough stock|only \d+ (left|available)|stock (is )?(not|un)available/i, "errors.outOfStock"],
  [/voucher.*(expired|ended|no longer)/i, "errors.voucherExpired"],
  [/minimum (spend|order|purchase)/i, "errors.voucherMinSpend"],
  [/(voucher|code).*(already (claimed|used|redeemed)|usage limit|fully redeemed|limit reached)/i, "errors.voucherUsed"],
  [/(voucher|code).*(invalid|not found|not valid|does not exist)/i, "errors.voucherInvalid"],
  [/can no longer be cancell?ed|already (shipped|delivered)|part of this order has already shipped/i, "errors.cannotCancel"],
  [/(file|image).*(too large|exceeds|size)|payload too large|413/i, "errors.fileTooLarge"],
  [/not allowed|permission denied|row-level security|violates row-level|unauthori[sz]ed|forbidden|403/i, "errors.notAllowed"],
];

// Looks like internal/database wording: never shown to shoppers.
const technical =
  /relation|column|function|violates|syntax|null value|duplicate key|json|pgrst|uuid|constraint|schema|rpc|undefined|typeerror|cannot read|unexpected token|stack|sqlstate|\b[0-9a-f]{8}-[0-9a-f]{4}/i;

/** An error whose message is already friendly and translated: shown as is. */
export class ShownError extends Error {}

export function errorText(caught: unknown): string {
  if (!caught) return "";
  if (typeof caught === "string") return caught;
  const e = caught as { message?: unknown; error?: unknown; error_description?: unknown };
  for (const value of [e.message, e.error_description, e.error]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/**
 * Friendly, translated message for an error. `fallback` is the page's own
 * phrase (e.g. "Unable to load your orders.") used when nothing more specific fits.
 */
export function friendlyError(caught: unknown, t: Translate, fallback: Key = "common.error"): string {
  if (caught instanceof ShownError) return caught.message;
  const raw = errorText(caught);
  if (!raw) return t(fallback);
  for (const [re, key] of patterns) if (re.test(raw)) return t(key);
  if (technical.test(raw) || raw.length > 180) {
    if (typeof console !== "undefined") console.warn("[MIVO]", raw);
    return t(fallback);
  }
  // Plain human sentence from our own server: fine in English; other languages get the translated fallback.
  return t("errors.lang") === "en" ? raw : t(fallback);
}
