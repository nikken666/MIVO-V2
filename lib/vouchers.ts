/**
 * Which vouchers a customer can still see and use.
 *
 * - A voucher can be used up to `per_user_limit` times (e.g. 3 free-shipping
 *   vouchers for new customers), not just once.
 * - "First order only" vouchers stop working once the customer has a paid order.
 * - "New customers only" vouchers can only be claimed before the first paid
 *   order; once claimed they keep working until used up or expired.
 */

export type VoucherRules = {
  id: string;
  per_user_limit?: number | string | null;
  first_order_only?: boolean | null;
  new_user_only?: boolean | null;
};

/** Paid-order statuses that make someone a returning customer. */
export const PAID_ORDER_STATUSES = ["paid", "processing", "packed", "shipped", "delivered", "completed"];

/** Times each voucher was used (reserved or redeemed) by this customer. */
export function voucherUses(rows: Array<{ voucher_id: string; status?: string }> | null | undefined) {
  const uses = new Map<string, number>();
  for (const row of rows || []) {
    if (row.status && row.status !== "reserved" && row.status !== "redeemed") continue;
    uses.set(row.voucher_id, (uses.get(row.voucher_id) || 0) + 1);
  }
  return uses;
}

/** Uses left for this customer (at least 1 allowed per voucher). */
export function usesLeft(voucher: VoucherRules, uses: Map<string, number>) {
  const limit = Math.max(1, Math.floor(Number(voucher.per_user_limit) || 1));
  return Math.max(0, limit - (uses.get(voucher.id) || 0));
}

/** Can this voucher be claimed or used by this customer right now? */
export function voucherAllowed(
  voucher: VoucherRules,
  { paidOrders, claimed, uses }: { paidOrders: number; claimed: boolean; uses: Map<string, number> }
) {
  if (usesLeft(voucher, uses) <= 0) return false;
  if (voucher.first_order_only && paidOrders > 0) return false;
  if (voucher.new_user_only && paidOrders > 0 && !claimed) return false;
  return true;
}
