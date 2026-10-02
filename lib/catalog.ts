import { createClient } from "@/lib/supabase/server";
import {
  products as demoProducts,
  type Product,
  type ProductPublicReview,
  type ProductVariant,
} from "@/data/products";

type NamedRelation = { name: string } | Array<{ name: string }> | null;

type ProductRow = {
  id: string;
  category_id: string | null;
  brand_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  short_description: string | null;
  warranty_months: number | null;
  primary_image_url: string | null;
  variation_1_name: string | null;
  variation_2_name: string | null;
  brands: NamedRelation;
  categories: NamedRelation;
  sellers: { shop_name: string } | Array<{ shop_name: string }> | null;
  product_images:
    | Array<{
        image_url: string;
        sort_order: number;
      }>
    | null;
  product_variants:
    | Array<{
        id: string;
        title: string | null;
        variation_1_value: string | null;
        variation_2_value: string | null;
        variant_image_url: string | null;
        sku: string;
        price: number | string;
        compare_at_price: number | string | null;
        discount_enabled: boolean;
        discount_percent: number | string | null;
        discount_starts_at: string | null;
        discount_ends_at: string | null;
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
    .map((variant) => {
      const regularPrice = Number(variant.price);
      const discountPercent = Number(variant.discount_percent || 0);
      const now = Date.now();
      const startsAt = variant.discount_starts_at
        ? new Date(variant.discount_starts_at).getTime()
        : null;
      const endsAt = variant.discount_ends_at
        ? new Date(variant.discount_ends_at).getTime()
        : null;
      const discountActive =
        Boolean(variant.discount_enabled) &&
        discountPercent > 0 &&
        (!startsAt || now >= startsAt) &&
        (!endsAt || now <= endsAt);
      const effectivePrice = discountActive
        ? Math.round(
            regularPrice * (1 - discountPercent / 100) * 100
          ) / 100
        : regularPrice;

      return {
        id: variant.id,
        title: variant.title?.trim() || "Default",
        variation1Value: variant.variation_1_value,
        variation2Value: variant.variation_2_value,
        imageUrl: variant.variant_image_url,
        sku: variant.sku,
        price: effectivePrice,
        compareAtPrice: discountActive
          ? regularPrice
          : variant.compare_at_price === null
            ? null
            : Number(variant.compare_at_price),
        discountPercent: discountActive ? discountPercent : null,
        discountEndsAt: discountActive
          ? variant.discount_ends_at
          : null,
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
      };
    });
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
    id: row.id,
    categoryId: row.category_id || undefined,
    brandId: row.brand_id || undefined,
    slug: row.slug,
    name: row.name,
    brand: relationName(row.brands, "MIVO"),
    category: relationName(row.categories, "Automotive Parts"),
    price: lowestPrice,
    reviews: 0,
    rating: 0,
    icon: "🔧",
    description:
      row.description || "Product details will be updated by the seller.",
    shortDescription: row.short_description || undefined,
    warrantyMonths:
      row.warranty_months === null ? null : Number(row.warranty_months),
    imageUrl:
      row.primary_image_url ||
      row.product_images?.slice().sort((a, b) => a.sort_order - b.sort_order)[0]?.image_url ||
      undefined,
    imageUrls: Array.from(
      new Set(
        [
          row.primary_image_url,
          ...(row.product_images || [])
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((image) => image.image_url),
        ].filter((url): url is string => Boolean(url))
      )
    ),
    seller: sellerName(row.sellers),
    sku: variants.length === 1 ? firstVariant.sku : undefined,
    stock: totalStock,
    variation1Name: row.variation_1_name,
    variation2Name: row.variation_2_name,
    variants,
  };
}

const selectQuery =
  "id, category_id, brand_id, slug, name, description, short_description, warranty_months, primary_image_url, variation_1_name, variation_2_name, brands(name), categories(name), sellers(shop_name), product_images(image_url, sort_order), product_variants(id, title, variation_1_value, variation_2_value, variant_image_url, sku, price, compare_at_price, discount_enabled, discount_percent, discount_starts_at, discount_ends_at, stock_on_hand, stock_reserved, weight_kg, length_cm, width_cm, height_cm, is_active)";

type ReviewStat = {
  rating: number;
  reviews: number;
};

async function getReviewStats(
  productIds: string[]
): Promise<Map<string, ReviewStat>> {
  const stats = new Map<string, ReviewStat>();

  if (productIds.length === 0) return stats;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "get_product_review_stats",
      { p_product_ids: productIds }
    );

    if (error) throw error;

    (
      (data as Array<{
        product_id: string;
        review_count: number | string;
        average_rating: number | string;
      }> | null) || []
    ).forEach((row) => {
      stats.set(row.product_id, {
        rating: Number(row.average_rating || 0),
        reviews: Number(row.review_count || 0),
      });
    });
  } catch {
    // Ratings should never prevent the catalog from loading.
  }

  return stats;
}

async function attachReviewStats(
  products: Product[]
): Promise<Product[]> {
  const productIds = products
    .map((product) => product.id)
    .filter((id): id is string => Boolean(id));

  const stats = await getReviewStats(productIds);

  return products.map((product) => {
    if (!product.id) return product;

    const reviewStat = stats.get(product.id);

    return {
      ...product,
      rating: reviewStat?.rating || 0,
      reviews: reviewStat?.reviews || 0,
    };
  });
}

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

    return live.length > 0 ? await attachReviewStats(live) : demoProducts;
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

    if (mapped) {
      const [withReviews] = await attachReviewStats([mapped]);
      return withReviews;
    }
  } catch {
    // Fall back to demo products.
  }

  return demoProducts.find((product) => product.slug === slug) || null;
}


export async function getProductPublicReviews(
  productId: string
): Promise<ProductPublicReview[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "get_product_public_reviews",
      { p_product_id: productId }
    );

    if (error) throw error;

    return (
      (data as Array<{
        id: string;
        rating: number;
        comment: string | null;
        image_urls: string[] | null;
        created_at: string;
        variant_name: string | null;
        verified_purchase: boolean;
      }> | null) || []
    ).map((review) => ({
      id: review.id,
      rating: Number(review.rating || 0),
      comment: review.comment,
      imageUrls: review.image_urls || [],
      createdAt: review.created_at,
      variantName: review.variant_name,
      verifiedPurchase: Boolean(review.verified_purchase),
    }));
  } catch {
    return [];
  }
}


export async function getRelatedProducts(
  product: Product,
  limit = 4
): Promise<Product[]> {
  if (!product.id) return [];

  try {
    const supabase = await createClient();

    async function runQuery(
      relation:
        | { categoryId: string }
        | { brandId: string }
        | { fallback: true }
    ) {
      let query = supabase
        .from("products")
        .select(selectQuery)
        .eq("status", "active")
        .neq("id", product.id!)
        .limit(limit);

      if ("categoryId" in relation) {
        query = query.eq("category_id", relation.categoryId);
      } else if ("brandId" in relation) {
        query = query.eq("brand_id", relation.brandId);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;

      return ((data || []) as unknown as ProductRow[])
        .map(mapProduct)
        .filter((item): item is Product => Boolean(item));
    }

    let related =
      product.categoryId
        ? await runQuery({ categoryId: product.categoryId })
        : [];

    if (related.length < limit && product.brandId) {
      const branded = await runQuery({ brandId: product.brandId });
      const seen = new Set(related.map((item) => item.id));

      related = [
        ...related,
        ...branded.filter((item) => !seen.has(item.id)),
      ].slice(0, limit);
    }

    if (related.length < limit) {
      const fallback = await runQuery({ fallback: true });
      const seen = new Set(related.map((item) => item.id));

      related = [
        ...related,
        ...fallback.filter((item) => !seen.has(item.id)),
      ].slice(0, limit);
    }

    return await attachReviewStats(related);
  } catch {
    return [];
  }
}
