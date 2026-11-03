import { createAdminClient } from "@/lib/supabase/admin";
import * as ep from "@/lib/easyparcel/api";

// Checkout shipping per shop: the buyer pays MIVO's price list (Shipping
// settings, Shopee-style rates), or EasyParcel's real cost when that is higher.
// The cost is from each shop's pickup address to the buyer, cheapest usable
// service. Throws when EasyParcel can't price every shop, so checkout falls
// back to MIVO's shipping rules alone.

type CartItem = { variant_id: string; quantity: number };

const CACHE_HOURS = 6;
const DEFAULT_DIMS = { length: 30, width: 20, height: 15 };

/** Optional fixed handling fee added per parcel (MYR), e.g. packing costs. */
function handlingFee() {
  const value = Number(process.env.EASYPARCEL_SHIPPING_MARKUP || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

async function cachedQuotes(sender: ep.Address, receiver: ep.Address, parcel: ep.Parcel) {
  const admin = createAdminClient();
  // Weight rounded up to 0.5 kg and size to 5 cm, so similar carts share a price.
  const w = Math.ceil(parcel.weight * 2) / 2;
  const dims = [parcel.length, parcel.width, parcel.height].map((d) => Math.ceil(d / 5) * 5);
  const key = [sender.postcode, ep.stateCode(sender.state), receiver.postcode, ep.stateCode(receiver.state), w, ...dims].join("|");
  const { data: hit } = await admin
    .from("easyparcel_rate_cache")
    .select("quotes, expires_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (hit && new Date(hit.expires_at).getTime() > Date.now()) return hit.quotes as ep.Quote[];
  const quotes = await ep.quote(sender, receiver, { ...parcel, weight: w, length: dims[0], width: dims[1], height: dims[2] });
  await admin.from("easyparcel_rate_cache").upsert({
    cache_key: key,
    quotes,
    expires_at: new Date(Date.now() + CACHE_HOURS * 3600 * 1000).toISOString(),
  });
  return quotes;
}

/** Cheapest service a shop can actually use (no "min N parcels" pickups). */
function cheapest(quotes: ep.Quote[]) {
  return quotes.filter((q) => !/min\s*\d+\s*parcel/i.test(q.serviceName))[0] || null;
}

export async function quoteCheckout(userId: string, items: CartItem[], address: { state: string; postcode: string }) {
  if (!items.length) throw new Error("Cart is empty.");
  if (!/^\d{5}$/.test(address.postcode) || !ep.stateCode(address.state)) throw new Error("Address incomplete.");
  const admin = createAdminClient();

  const { data: variants } = await admin
    .from("product_variants")
    .select("id, seller_id, price, weight_kg, length_cm, width_cm, height_cm")
    .in("id", items.map((i) => i.variant_id));
  const byId = new Map((variants || []).map((v) => [v.id, v]));
  if (byId.size !== new Set(items.map((i) => i.variant_id)).size) throw new Error("Unknown item in cart.");

  const sellerIds = Array.from(new Set((variants || []).map((v) => v.seller_id)));
  const { data: shopRows } = await admin.from("sellers").select("id, shop_name, tier, owner_id, pickup_address").in("id", sellerIds);

  // Shops of one owner shipping from the same address travel as one parcel
  // (same rule as mivo_pickup_group in supabase/combined-shipping.sql).
  const groupKey = (shop: { id: string; owner_id: string | null; pickup_address: unknown }) => {
    const p = (shop.pickup_address || {}) as Record<string, string>;
    if (!p.postcode || !p.line) return "shop:" + shop.id;
    return (shop.owner_id || "none") + "|" + p.postcode + "|" + p.line.toLowerCase().replace(/[^a-z0-9]/g, "");
  };
  const ordered = (shopRows || [])
    .slice()
    .sort((a, b) => Number(b.tier === "direct") - Number(a.tier === "direct") || a.shop_name.localeCompare(b.shop_name));
  const groups = new Map<string, typeof ordered>();
  for (const shop of ordered) {
    const key = groupKey(shop);
    groups.set(key, [...(groups.get(key) || []), shop]);
  }

  // MIVO's own price list (Shipping settings), per shop: what the buyer pays,
  // unless EasyParcel's real cost is higher (then the cost, so MIVO never loses).
  const priceList = new Map<string, number>();
  const { data: rules } = await admin.rpc("quote_shipping_by_shop", {
    p_items: items,
    p_state: address.state,
    p_postcode: address.postcode,
  });
  for (const shop of (rules as Array<{ seller_id: string; options?: Array<{ shipping_amount: number | string }> }> | null) || []) {
    const prices = (shop.options || []).map((o) => Number(o.shipping_amount)).filter((n) => Number.isFinite(n));
    if (prices.length) priceList.set(shop.seller_id, Math.min(...prices));
  }

  const receiver: ep.Address = { name: "Buyer", phone: "0", line1: "-", postcode: address.postcode, city: "-", state: address.state };
  const results: Array<{
    seller_id: string;
    seller_ids: string[];
    group: string;
    shop_name: string;
    tier: string | null;
    amount: number;
    cost: number;
    courier: string;
    service_id: string;
  }> = [];

  for (const [key, members] of groups) {
    const shop = members[0];
    const memberIds = new Set(members.map((m) => m.id));
    const pickup = (shop.pickup_address || {}) as Record<string, string>;
    if (!pickup.postcode || !pickup.state) throw new Error("Shop " + shop.shop_name + " has no pickup address.");
    let weight = 0;
    let length = 0;
    let width = 0;
    let height = 0;
    let value = 0;
    for (const item of items) {
      const v = byId.get(item.variant_id) as Record<string, unknown> | undefined;
      if (!v || !memberIds.has(String(v.seller_id))) continue;
      const qty = Number(item.quantity || 1);
      weight += Number(v.weight_kg || 0.5) * qty;
      length = Math.max(length, Number(v.length_cm || 0));
      width = Math.max(width, Number(v.width_cm || 0));
      height += Number(v.height_cm || 0) * qty;
      value += Number(v.price || 0) * qty;
    }
    const sender: ep.Address = { name: shop.shop_name, phone: "0", line1: "-", postcode: pickup.postcode, city: pickup.city || "-", state: pickup.state };
    const quotes = await cachedQuotes(sender, receiver, {
      weight: Math.max(0.1, weight),
      length: length || DEFAULT_DIMS.length,
      width: width || DEFAULT_DIMS.width,
      height: Math.min(height, 100) || DEFAULT_DIMS.height,
      value: Math.round(value * 100) / 100,
      content: "Car parts",
    });
    const best = cheapest(quotes);
    if (!best) throw new Error("No EasyParcel service for " + shop.shop_name + ".");
    results.push({
      seller_id: shop.id,
      seller_ids: members.map((m) => m.id),
      group: key,
      shop_name: members.map((m) => m.shop_name).join(" · "),
      tier: shop.tier,
      // MIVO's price list is per parcel too (quote_shipping_by_shop groups the same way).
      amount: Math.round(Math.max(priceList.get(shop.id) ?? 0, best.price + handlingFee()) * 100) / 100,
      cost: best.price,
      courier: best.courierName,
      service_id: best.serviceId,
    });
  }

  const itemsKey = items
    .slice()
    .sort((a, b) => a.variant_id.localeCompare(b.variant_id))
    .map((i) => i.variant_id + ":" + i.quantity)
    .join(",");
  const { data: saved, error } = await admin
    .from("checkout_shipping_quotes")
    .insert({ user_id: userId, items_key: itemsKey, postcode: address.postcode, state: address.state, shops: results })
    .select("id")
    .single();
  if (error || !saved) throw new Error("Could not save the shipping quote: " + (error?.message || ""));

  return {
    quoteId: saved.id as string,
    shops: results.map(({ seller_id, seller_ids, shop_name, tier, amount }) => ({ seller_id, seller_ids, shop_name, tier, amount })),
  };
}
