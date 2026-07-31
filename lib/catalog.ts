import { createClient } from "@/lib/supabase/server";
import { products as demoProducts, type Product } from "@/data/products";

type NamedRelation = { name: string } | Array<{ name: string }> | null;

type ProductRow = {
  slug: string;
  name: string;
  description: string | null;
  primary_image_url: string | null;
  brands: NamedRelation;
  categories: NamedRelation;
  sellers: { shop_name: string } | Array<{ shop_name: string }> | null;
  product_variants:
    | Array<{
        sku: string;
        price: number | string;
        stock_on_hand: number;
        stock_reserved: number;
        is_active: boolean;
      }>
    | null;
};

function relationName(value: NamedRelation, fallback: string) {
  if (Array.isArray(value)) return value[0]?.name || fallback;
  return value?.name || fallback;
}

function sellerName(
  value:
    | { shop_name: string }
    | Array<{ shop_name: string }>
    | null
) {
  if (Array.isArray(value)) return value[0]?.shop_name || "MIVO Seller";
  return value?.shop_name || "MIVO Seller";
}

function mapProduct(row: ProductRow): Product | null {
  const variant = row.product_variants?.find((item) => item.is_active);

  if (!variant) return null;

  return {
    slug: row.slug,
    name: row.name,
    brand: relationName(row.brands, "MIVO"),
    category: relationName(row.categories, "Automotive Parts"),
    price: Number(variant.price),
    reviews: 0,
    icon: "🔧",
    description: row.description || "Product details will be updated by the seller.",
    imageUrl: row.primary_image_url || undefined,
    seller: sellerName(row.sellers),
    sku: variant.sku,
    stock: Math.max(0, variant.stock_on_hand - variant.stock_reserved),
  };
}

const selectQuery =
  "slug, name, description, primary_image_url, brands(name), categories(name), sellers(shop_name), product_variants(sku, price, stock_on_hand, stock_reserved, is_active)";

export async function getActiveProducts(): Promise<Product[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select(selectQuery)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const live = ((data || []) as unknown as ProductRow[])
      .map(mapProduct)
      .filter((product): product is Product => Boolean(product));

    return live.length > 0 ? live : demoProducts;
  } catch {
    return demoProducts;
  }
}

export async function getActiveProductBySlug(
  slug: string
): Promise<Product | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select(selectQuery)
      .eq("slug", slug)
      .eq("status", "active")
      .limit(1);

    if (error) throw error;

    const row = (data?.[0] || null) as unknown as ProductRow | null;
    const mapped = row ? mapProduct(row) : null;

    if (mapped) return mapped;
  } catch {
    // Fall back to the demo products below.
  }

  return demoProducts.find((product) => product.slug === slug) || null;
}
