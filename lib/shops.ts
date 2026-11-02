import { createClient } from "@/lib/supabase/server";
import type { ShopTier } from "@/components/ShopBadge";

export type Shop = {
  id: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  tagline: string | null;
  tier: ShopTier;
  sortOrder: number;
};

type ShopRow = {
  id: string;
  shop_name: string;
  slug: string | null;
  logo_url: string | null;
  banner_url: string | null;
  description: string | null;
  tier?: ShopTier | null;
  tagline?: string | null;
  sort_order?: number | null;
};

const shopColumns =
  "id, shop_name, slug, logo_url, banner_url, description, tier, tagline, sort_order";
// Before supabase/multi-shop-linked-stock.sql runs, tier/tagline/sort_order don't exist.
const legacyShopColumns = "id, shop_name, slug, logo_url, banner_url, description";

const tierRank: Record<ShopTier, number> = { direct: 0, preferred: 1, standard: 2 };

function mapShop(row: ShopRow): Shop {
  const tier: ShopTier =
    row.tier || (/^mivo direct/i.test(row.shop_name) ? "direct" : "standard");
  return {
    id: row.id,
    name: row.shop_name,
    slug: row.slug,
    logoUrl: row.logo_url,
    bannerUrl: row.banner_url,
    description: row.description,
    tagline: row.tagline ?? null,
    tier,
    sortOrder: row.sort_order ?? (tier === "direct" ? 0 : 100),
  };
}

async function selectShops(filter?: { key: string }) {
  const supabase = await createClient();
  const isUuid = filter && /^[0-9a-f-]{36}$/i.test(filter.key);

  for (const columns of [shopColumns, legacyShopColumns]) {
    let query = supabase.from("sellers").select(columns).eq("status", "approved");
    if (filter) query = isUuid ? query.eq("id", filter.key) : query.eq("slug", filter.key);
    const { data, error } = await query;
    if (!error) return ((data || []) as unknown as ShopRow[]).map(mapShop);
  }
  return [];
}

export async function getShops(): Promise<Shop[]> {
  try {
    const shops = await selectShops();
    return shops.sort(
      (a, b) =>
        tierRank[a.tier] - tierRank[b.tier] ||
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name)
    );
  } catch {
    return [];
  }
}

export async function getShop(key: string): Promise<Shop | null> {
  try {
    const [shop] = await selectShops({ key });
    return shop || null;
  } catch {
    return null;
  }
}

export function shopPath(shop: Pick<Shop, "slug" | "id">) {
  return "/shops/" + encodeURIComponent(shop.slug || shop.id);
}
