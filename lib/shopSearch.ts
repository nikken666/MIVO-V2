import type { Product } from "@/data/products";
import { getShops, shopPath, type Shop } from "@/lib/shops";

export type ShopHit = {
  id: string;
  name: string;
  href: string;
  logoUrl: string | null;
  tier: Shop["tier"];
  tagline: string | null;
  products: number;
};

// Shops change rarely; one list per server per minute (like the catalogue).
let shopCache: { at: number; promise: Promise<Shop[]> } | null = null;
function cachedShops() {
  if (!shopCache || Date.now() - shopCache.at > 60_000) {
    const promise = getShops();
    shopCache = { at: Date.now(), promise };
    promise.catch(() => {
      if (shopCache?.promise === promise) shopCache = null;
    });
  }
  return shopCache.promise;
}

const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "");

/** Shopee-style "shops related to …": shops whose name matches what was typed. */
export async function searchShops(q: string, products: Product[], limit = 3): Promise<ShopHit[]> {
  const needle = squash(q);
  if (needle.length < 2) return [];
  const shops = await cachedShops();
  const tierRank = { direct: 0, preferred: 1, standard: 2 } as const;

  const hits = shops
    .map((shop) => {
      const name = squash(shop.name);
      const slug = squash(shop.slug || "");
      const score = name.startsWith(needle) ? 0 : name.includes(needle) || slug.includes(needle) ? 1 : -1;
      return { shop, score };
    })
    .filter((hit) => hit.score >= 0)
    .sort((a, b) => a.score - b.score || tierRank[a.shop.tier] - tierRank[b.shop.tier] || a.shop.name.localeCompare(b.shop.name))
    .slice(0, limit);

  return hits.map(({ shop }) => ({
    id: shop.id,
    name: shop.name,
    href: shopPath(shop),
    logoUrl: shop.logoUrl,
    tier: shop.tier,
    tagline: shop.tagline || null,
    products: products.filter((p) => (p.sellerId ? p.sellerId === shop.id : p.seller === shop.name)).length,
  }));
}
