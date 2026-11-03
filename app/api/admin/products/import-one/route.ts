import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type VariantInput = {
  title: string;
  variation_1_value: string | null;
  variation_2_value: string | null;
  sku: string;
  price: number;
  stock_on_hand: number;
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  variant_image_url: string | null;
};

type Body = {
  shopId?: string;
  product?: {
    category_id: string | null;
    brand_id: string | null;
    name: string;
    slug: string;
    description: string | null;
    primary_image_url: string | null;
    warranty_months: number;
    variation_1_name: string | null;
    variation_2_name: string | null;
    status: "draft" | "active";
  };
  variants?: VariantInput[];
  images?: string[];
};

const isUnique = (e: { code?: string; message?: string } | null) =>
  Boolean(e && (e.code === "23505" || /duplicate key|unique/i.test(e.message || "")));

/**
 * Shopee import, one product at a time, written by the server after checking
 * the user may manage the shop. Doing it here (not from the browser) keeps
 * imports working whatever row-level rules the live database has on products.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const body = (await request.json()) as Body;
    const { shopId, product, variants = [], images = [] } = body;
    if (!shopId || !product?.name?.trim()) return NextResponse.json({ error: "Missing product." }, { status: 400 });
    if (!variants.length) return NextResponse.json({ error: "No SKUs to import." }, { status: 400 });

    const admin = createAdminClient();
    const [{ data: isAdmin }, { data: shop }] = await Promise.all([
      supabase.rpc("is_admin"),
      admin.from("sellers").select("id, owner_id, status").eq("id", shopId).maybeSingle(),
    ]);
    if (!shop) return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    if (!isAdmin && !(shop.owner_id === user.id && shop.status === "approved")) {
      return NextResponse.json({ error: "You can only import into your own shop." }, { status: 403 });
    }

    const { data: created, error: productError } = await admin
      .from("products")
      .insert({
        seller_id: shopId,
        category_id: product.category_id,
        brand_id: product.brand_id,
        name: product.name.trim().slice(0, 300),
        slug: product.slug,
        short_description: null,
        description: product.description,
        primary_image_url: product.primary_image_url,
        warranty_months: Math.max(0, Math.round(Number(product.warranty_months) || 0)),
        variation_1_name: product.variation_1_name,
        variation_2_name: product.variation_2_name,
        is_universal_fitment: false,
        restricted_shipping_states: [],
        status: product.status === "active" ? "active" : "draft",
        published_at: product.status === "active" ? new Date().toISOString() : null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (productError || !created) throw productError || new Error("Product not created.");

    try {
      const rows = (suffix: string) =>
        variants.map((v, index) => ({
          product_id: created.id,
          seller_id: shopId,
          sort_order: index,
          title: v.title || "Default",
          variation_1_value: v.variation_1_value,
          variation_2_value: v.variation_2_value,
          sku: String(v.sku).slice(0, 120) + suffix,
          price: Math.max(0, Number(v.price) || 0),
          compare_at_price: null,
          stock_on_hand: Math.max(0, Math.round(Number(v.stock_on_hand) || 0)),
          stock_reserved: 0,
          low_stock_threshold: 5,
          weight_kg: Number(v.weight_kg) || 0,
          length_cm: Number(v.length_cm) || 0,
          width_cm: Number(v.width_cm) || 0,
          height_cm: Number(v.height_cm) || 0,
          variant_image_url: v.variant_image_url,
          is_active: true,
        }));
      // A SKU the shop already has (another listing, or an earlier import):
      // keep this one as -B, -C… instead of failing.
      let variantError: { code?: string; message?: string } | null = null;
      for (const suffix of ["", "-B", "-C", "-D", "-E", "-F", "-G", "-H"]) {
        ({ error: variantError } = await admin.from("product_variants").insert(rows(suffix)));
        if (!isUnique(variantError)) break;
      }
      if (variantError) throw variantError;

      if (images.length) {
        const { error: imageError } = await admin.from("product_images").insert(
          images.slice(0, 9).map((image_url, sort_order) => ({
            product_id: created.id,
            image_url,
            alt_text: product.name.slice(0, 200),
            sort_order,
          }))
        );
        if (imageError) throw imageError;
      }
    } catch (inner) {
      // Roll back the half-created product so a re-run starts clean.
      await admin.from("products").delete().eq("id", created.id);
      throw inner;
    }

    return NextResponse.json({ id: created.id });
  } catch (caught) {
    const e = caught as { message?: string; code?: string; details?: string };
    return NextResponse.json(
      { error: [e?.message || "Import failed.", e?.details, e?.code ? "(" + e.code + ")" : ""].filter(Boolean).join(" · ") },
      { status: 500 }
    );
  }
}
