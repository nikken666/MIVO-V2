import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const PRODUCT_COLUMNS =
  "id, seller_id, name, slug, status, primary_image_url, created_at, brands(name), product_variants(id, sort_order, title, variation_1_value, variation_2_value, sku, price, compare_at_price, stock_on_hand, stock_reserved, low_stock_threshold, weight_kg, length_cm, width_cm, height_cm, discount_enabled, discount_percent, discount_starts_at, discount_ends_at)";
const PAGE = 1000;

/**
 * Products page (MIVO admin): every product of MIVO's own shops in one go,
 * without the long descriptions and photo galleries (loaded only when a
 * product is edited). Read by the server after checking the admin, so the
 * row rules aren't evaluated for thousands of rows.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

    const admin = createAdminClient();
    // MIVO's shops: the ones this account owns, plus MIVO Direct.
    const [{ data: owned }, { data: direct }] = await Promise.all([
      supabase.rpc("seller_my_shops"),
      admin.from("sellers").select("id, shop_name, tier").eq("tier", "direct"),
    ]);
    const shopMap = new Map<string, { id: string; name: string; tier: string | null }>();
    for (const row of [
      ...(((direct as Array<{ id: string; shop_name: string; tier: string | null }> | null) || [])),
      ...(((owned as Array<{ id: string; shop_name: string; tier: string | null }> | null) || [])),
    ]) {
      shopMap.set(row.id, { id: row.id, name: row.shop_name, tier: row.tier });
    }
    const shops = Array.from(shopMap.values()).sort(
      (a, b) => Number(b.tier === "direct") - Number(a.tier === "direct") || a.name.localeCompare(b.name)
    );
    const shopIds = shops.map((s) => s.id);
    if (!shopIds.length) return NextResponse.json({ shops, products: [] });

    const { count, error: countError } = await admin
      .from("products")
      .select("id", { count: "exact", head: true })
      .in("seller_id", shopIds);
    if (countError) throw countError;

    // Pages of 1,000 fetched side by side.
    const pages = Math.ceil((count || 0) / PAGE);
    const results = await Promise.all(
      Array.from({ length: pages }, (_, i) =>
        admin
          .from("products")
          .select(PRODUCT_COLUMNS)
          .in("seller_id", shopIds)
          .order("created_at", { ascending: false })
          .order("id")
          .range(i * PAGE, i * PAGE + PAGE - 1)
      )
    );
    const products: unknown[] = [];
    for (const result of results) {
      if (result.error) throw result.error;
      products.push(...(result.data || []));
    }
    return NextResponse.json({ shops, products });
  } catch (caught) {
    const e = caught as { message?: string };
    return NextResponse.json({ error: e?.message || "Couldn't load products." }, { status: 500 });
  }
}
