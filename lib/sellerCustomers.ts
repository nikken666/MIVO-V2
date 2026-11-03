import type { SupabaseClient } from "@supabase/supabase-js";

export type CustomerInfo = { id: string; full_name: string | null; avatar_url: string | null };

/**
 * Names and order numbers a seller may see (supabase/seller-customer-names.sql).
 * Used to fill in what the seller can't read from profiles/orders directly.
 * Returns empty lists if the function isn't installed yet.
 */
export async function sellerCustomerInfo(
  supabase: SupabaseClient,
  customerIds: string[],
  orderIds: string[]
): Promise<{ people: CustomerInfo[]; orders: Array<{ id: string; order_number: string }> }> {
  if (!customerIds.length && !orderIds.length) return { people: [], orders: [] };
  const { data, error } = await supabase.rpc("seller_customer_info", {
    p_customer_ids: customerIds,
    p_order_ids: orderIds,
  });
  if (error || !data) return { people: [], orders: [] };
  const value = data as { people?: CustomerInfo[]; orders?: Array<{ id: string; order_number: string }> };
  return { people: value.people || [], orders: value.orders || [] };
}
