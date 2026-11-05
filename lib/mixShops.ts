import type { Product } from "@/data/products";

// Lists mix the shops instead of showing one shop's newest imports in a row:
// shops take turns (round-robin), and the order changes once a day
// (Malaysia time) so it stays the same while someone pages through.

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function dayKey(now = Date.now()) {
  return new Date(now + 8 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Shops take turns. `shuffle` (default) also reorders each shop's own
 * products for the day; without it each shop keeps the order it was given
 * (e.g. biggest discount first).
 */
export function mixShops<T extends Pick<Product, "slug" | "sellerId" | "seller">>(
  items: T[],
  options: { shuffle?: boolean; seed?: string } = {}
): T[] {
  const seed = options.seed || dayKey();
  const shuffle = options.shuffle !== false;
  const byShop = new Map<string, T[]>();
  for (const item of items) {
    const shop = item.sellerId || item.seller || "";
    const list = byShop.get(shop);
    if (list) list.push(item);
    else byShop.set(shop, [item]);
  }
  const queues = [...byShop.entries()]
    .sort((a, b) => hash(seed + a[0]) - hash(seed + b[0]))
    .map(([, list]) =>
      shuffle
        ? list
            .map((item) => ({ item, key: hash(seed + item.slug) }))
            .sort((a, b) => a.key - b.key)
            .map((entry) => entry.item)
        : list
    );
  const out: T[] = [];
  for (let round = 0; out.length < items.length; round++) {
    for (const queue of queues) if (round < queue.length) out.push(queue[round]);
  }
  return out;
}
