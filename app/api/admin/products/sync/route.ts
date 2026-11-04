import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

type Row = { id: string; price: number; compare_at_price: number | null; stock?: number | null; external_ref?: string | null };
type Body = {
  shopId?: string;
  variants?: Row[];
  products?: Array<{ id: string; external_ref: string }>;
};

const missingColumn = (e: { code?: string; message?: string } | null) =>
  Boolean(e && (e.code === "42703" || e.code === "PGRST204" || /external_ref/.test(e.message || "")));
const missingFunction = (e: { code?: string; message?: string } | null) =>
  Boolean(e && (e.code === "PGRST202" || e.code === "42883" || /mivo_sync_variants/.test(e.message || "")));

/**
 * Import from Shopee, products already in the shop: update their options'
 * price, original (struck-through) price and optionally stock, and remember
 * Shopee's IDs. Only options of a shop the user may manage are touched.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const body = (await request.json()) as Body;
    const shopId = body.shopId || "";
    const rows = (body.variants || [])
      .filter((r) => r && typeof r.id === "string" && Number.isFinite(Number(r.price)))
      .slice(0, 1000)
      .map((r) => ({
        id: r.id,
        price: Math.max(0, Math.round(Number(r.price) * 100) / 100),
        compare_at_price:
          r.compare_at_price != null && Number(r.compare_at_price) > Number(r.price)
            ? Math.round(Number(r.compare_at_price) * 100) / 100
            : null,
        stock: r.stock == null ? null : Math.max(0, Math.round(Number(r.stock) || 0)),
        external_ref: r.external_ref ? String(r.external_ref).slice(0, 120) : null,
      }));
    if (!shopId || !rows.length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

    const admin = createAdminClient();
    const [{ data: isAdmin }, { data: shop }] = await Promise.all([
      supabase.rpc("is_admin"),
      admin.from("sellers").select("id, owner_id, status").eq("id", shopId).maybeSingle(),
    ]);
    if (!shop) return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    if (!isAdmin && !(shop.owner_id === user.id && shop.status === "approved")) {
      return NextResponse.json({ error: "You can only update your own shop." }, { status: 403 });
    }

    // One statement for the whole batch (supabase/shopee-sync.sql) …
    let updated = 0;
    const { data, error } = await admin.rpc("mivo_sync_variants", { p_shop: shopId, p_rows: rows });
    if (!error) {
      updated = Number(data) || 0;
    } else if (missingFunction(error)) {
      // … or one update per option on a database without it.
      const now = new Date().toISOString();
      for (let i = 0; i < rows.length; i += 10) {
        const results = await Promise.all(
          rows.slice(i, i + 10).map((r) => {
            const patch: Record<string, unknown> = { price: r.price, compare_at_price: r.compare_at_price, updated_at: now };
            if (r.stock != null) patch.stock_on_hand = r.stock;
            return admin.from("product_variants").update(patch).eq("id", r.id).eq("seller_id", shopId).select("id");
          })
        );
        for (const result of results) {
          if (result.error) throw result.error;
          updated += (result.data || []).length;
        }
      }
    } else {
      throw error;
    }

    // Remember Shopee Item IDs on products (when the column exists).
    let refs = 0;
    const products = (body.products || []).filter((p) => p?.id && p.external_ref).slice(0, 1000);
    for (let i = 0; i < products.length; i += 10) {
      const results = await Promise.all(
        products.slice(i, i + 10).map((product) =>
          admin
            .from("products")
            .update({ external_ref: String(product.external_ref).slice(0, 120) })
            .eq("id", product.id)
            .eq("seller_id", shopId)
        )
      );
      if (results.some((r) => missingColumn(r.error))) break;
      refs += results.filter((r) => !r.error).length;
    }

    return NextResponse.json({ updated, refs });
  } catch (caught) {
    const e = caught as { message?: string; code?: string; details?: string };
    return NextResponse.json(
      { error: [e?.message || "Update failed.", e?.details, e?.code ? "(" + e.code + ")" : ""].filter(Boolean).join(" · ") },
      { status: 500 }
    );
  }
}
