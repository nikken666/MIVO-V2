/**
 * Google Analytics 4 + Meta (Facebook) Pixel events.
 * Both are optional: nothing happens until NEXT_PUBLIC_GA_ID / NEXT_PUBLIC_META_PIXEL_ID
 * are set in Vercel. Every call is safe to make anywhere and never throws.
 */

export const GA_ID = (process.env.NEXT_PUBLIC_GA_ID || "").trim();
export const META_PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID || "").trim();

export type TrackItem = {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  brand?: string | null;
  category?: string | null;
  variant?: string | null;
};

type Win = Window & {
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
};

function win(): Win | null {
  return typeof window === "undefined" ? null : (window as Win);
}

function safe(run: () => void) {
  try {
    run();
  } catch {
    // analytics must never break the shop
  }
}

function gaItems(items: TrackItem[]) {
  return items.map((item) => ({
    item_id: item.id,
    item_name: item.name,
    price: Number(item.price) || 0,
    quantity: item.quantity ?? 1,
    ...(item.brand ? { item_brand: item.brand } : {}),
    ...(item.category ? { item_category: item.category } : {}),
    ...(item.variant ? { item_variant: item.variant } : {}),
  }));
}

function value(items: TrackItem[]) {
  return Math.round(items.reduce((sum, item) => sum + (Number(item.price) || 0) * (item.quantity ?? 1), 0) * 100) / 100;
}

function send(gaEvent: string, metaEvent: string | null, items: TrackItem[], extra: Record<string, unknown> = {}) {
  const w = win();
  if (!w) return;
  const total = typeof extra.value === "number" ? (extra.value as number) : value(items);
  safe(() => w.gtag?.("event", gaEvent, { currency: "MYR", value: total, items: gaItems(items), ...extra }));
  if (metaEvent) {
    safe(() =>
      w.fbq?.("track", metaEvent, {
        currency: "MYR",
        value: total,
        content_type: "product",
        content_ids: items.map((item) => item.id),
        contents: items.map((item) => ({ id: item.id, quantity: item.quantity ?? 1 })),
        num_items: items.reduce((sum, item) => sum + (item.quantity ?? 1), 0),
      })
    );
  }
}

export const trackViewItem = (item: TrackItem) => send("view_item", "ViewContent", [item]);
export const trackAddToCart = (item: TrackItem) => send("add_to_cart", "AddToCart", [item]);
export const trackBeginCheckout = (items: TrackItem[]) => send("begin_checkout", "InitiateCheckout", items);

/** Once per order (a reload of the success page doesn't count it twice). */
export function trackPurchase(order: { number: string; total: number; shipping?: number; coupon?: string | null }, items: TrackItem[]) {
  const key = "mivo:tracked:" + order.number;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch {}
  send("purchase", "Purchase", items, {
    transaction_id: order.number,
    value: Number(order.total) || 0,
    shipping: Number(order.shipping) || 0,
    ...(order.coupon ? { coupon: order.coupon } : {}),
  });
}

export function trackSignUp(method = "email") {
  const w = win();
  if (!w) return;
  safe(() => w.gtag?.("event", "sign_up", { method }));
  safe(() => w.fbq?.("track", "CompleteRegistration"));
}
