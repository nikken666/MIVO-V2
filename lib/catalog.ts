import { createClient } from "@/lib/supabase/server";
import {
  products as demoProducts,
  type Product,
  type ProductVariant,
} from "@/data/products";

type NamedRelation = { name: string } | Array<{ name: string }> | null;

type ProductRow = {
  slug: string;
  name: string;
  description: string | null;
  primary_image_url: string | null;
  variation_1_name: string | null;
  variation_2_name: string | null;
  brands: NamedRelation;
  categories: NamedRelation;
  sellers: { shop_name: string } | Array<{ shop_name: string }> | null;
  product_variants:
    | Array<{
        id: string;
        title: string | null;
        variation_1_value: string | null;
        variation_2_value: string | null;
        sku: string;
        price: number | string;
        compare_at_price: number | string | null;
        stock_on_hand: number;
        stock_reserved: number;
        weight_kg: number | string | null;
        length_cm: number | string | null;
        width_cm: number | string | null;
        height_cm: number | string | null;
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

function mapVariants(row: ProductRow): ProductVariant[] {
  return (row.product_variants || [])
    .filter((variant) => variant.is_active)
    .map((variant) => ({
      id: variant.id,
      title: variant.title?.trim() || "Default",
      variation1Value: variant.variation_1_value,
      variation2Value: variant.variation_2_value,
      sku: variant.sku,
      price: Number(variant.price),
      compareAtPrice:
        variant.compare_at_price === null
          ? null
          : Number(variant.compare_at_price),
      stock: Math.max(
        0,
        Number(variant.stock_on_hand || 0) -
          Number(variant.stock_reserved || 0)
      ),
      weightKg: Number(variant.weight_kg || 0),
      lengthCm: Number(variant.length_cm || 0),
      widthCm: Number(variant.width_cm || 0),
      heightCm: Number(variant.height_cm || 0),
      isActive: true,
    }));
}

function mapProduct(row: ProductRow): Product | null {
  const variants = mapVariants(row);
  if (variants.length === 0) return null;

  const lowestPrice = Math.min(...variants.map((variant) => variant.price));
  const totalStock = variants.reduce(
    (total, variant) => total + variant.stock,
    0
  );
  const firstVariant = variants[0];

  return {
    slug: row.slug,
    name: row.name,
    brand: relationName(row.brands, "MIVO"),
    category: relationName(row.categories, "Automotive Parts"),
    price: lowestPrice,
    reviews: 0,
    icon: "🔧",
    description:
      row.description || "Product details will be updated by the seller.",
    imageUrl: row.primary_image_url || undefined,
    seller: sellerName(row.sellers),
    sku: variants.length === 1 ? firstVariant.sku : undefined,
    stock: totalStock,
    variation1Name: row.variation_1_name,
    variation2Name: row.variation_2_name,
    variants,
  };
}

const selectQuery =
  "slug, name, description, primary_image_url, variation_1_name, variation_2_name, brands(name), categories(name), sellers(shop_name), product_variants(id, title, variation_1_value, variation_2_value, sku, price, compare_at_price, stock_on_hand, stock_reserved, weight_kg, length_cm, width_cm, height_cm, is_active)";

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
    // Fall back to demo products.
  }

  return demoProducts.find((product) => product.slug === slug) || null;
}
