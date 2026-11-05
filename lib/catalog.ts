import { createClient } from "@/lib/supabase/server";
import { attachFitmentLevels } from "@/lib/fitmentLevels";
import { mapLimit } from "@/lib/mapLimit";
import {
  products as demoProducts,
  type Product,
  type ProductPublicReview,
  type ProductVariant,
} from "@/data/products";

type NamedRelation = { name: string } | Array<{ name: string }> | null;

type SellerRelation = {
  id?: string;
  shop_name: string;
  slug?: string | null;
  tier?: "direct" | "preferred" | "standard" | null;
  logo_url?: string | null;
};

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
  is_universal_fitment: boolean;
  restricted_shipping_states: string[] | null;
  brands: NamedRelation;
  categories: NamedRelation;
  sellers: SellerRelation | Array<SellerRelation> | null;
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
        sort_order: number;
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

function sellerOf(value: SellerRelation | Array<SellerRelation> | null) {
  return (Array.isArray(value) ? value[0] : value) || null;
}

function sellerName(value: SellerRelation | Array<SellerRelation> | null) {
  return sellerOf(value)?.shop_name || "MIVO Seller";
}

function mapVariants(row: ProductRow): ProductVariant[] {
  return (row.product_variants || [])
    .filter((variant) => variant.is_active)
    .slice()
    .sort(
      (a, b) =>
        Number(a.sort_order || 0) - Number(b.sort_order || 0)
    )
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
    sellerId: sellerOf(row.sellers)?.id || undefined,
    sellerSlug: sellerOf(row.sellers)?.slug || undefined,
    sellerTier: sellerOf(row.sellers)?.tier || undefined,
    sellerLogo: sellerOf(row.sellers)?.logo_url || undefined,
    sku: variants.length === 1 ? firstVariant.sku : undefined,
    stock: totalStock,
    variation1Name: row.variation_1_name,
    variation2Name: row.variation_2_name,
    isUniversalFitment: Boolean(row.is_universal_fitment),
    restrictedShippingStates: row.restricted_shipping_states || [],
    variants,
  };
}

const selectQuery =
  "id, category_id, brand_id, slug, name, description, short_description, warranty_months, primary_image_url, variation_1_name, variation_2_name, is_universal_fitment, restricted_shipping_states, brands(name), categories(name), sellers(id, shop_name, slug, tier, logo_url), product_images(image_url, sort_order), product_variants(id, title, variation_1_value, variation_2_value, variant_image_url, sort_order, sku, price, compare_at_price, discount_enabled, discount_percent, discount_starts_at, discount_ends_at, stock_on_hand, stock_reserved, weight_kg, length_cm, width_cm, height_cm, is_active)";

// Until supabase/multi-shop-linked-stock.sql has run, the shop columns
// (e.g. sellers.tier) don't exist; fall back to the previous query so the
// catalogue keeps working whichever is deployed first.
const legacySelectQuery = selectQuery.replace(
  "sellers(id, shop_name, slug, tier, logo_url)",
  "sellers(shop_name)"
);
let shopColumnsAvailable = true;

type QueryResult = { data: unknown; error: { code?: string; message?: string } | null };

async function withShopFallback(
  run: (select: string) => PromiseLike<QueryResult>
): Promise<QueryResult> {
  if (shopColumnsAvailable) {
    const result = await run(selectQuery);
    if (!result.error) return result;
    const missingColumn =
      result.error.code === "42703" || /column .* does not exist/i.test(result.error.message || "");
    const denied = result.error.code === "42501" || /permission/i.test(result.error.message || "");
    if (!missingColumn && !denied) return result;
    // Only a missing column is permanent; a permission error is retried next
    // time, so one bad request can't hide shop names and "Chat now" for good.
    if (missingColumn) shopColumnsAvailable = false;
  }
  return run(legacySelectQuery);
}

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

// The whole live catalogue is needed by the home page, the product list,
// shops, search suggestions and recommendations. Loading thousands of
// products from the database on every request made those pages take many
// seconds, so it's kept in memory for a minute per server (one load shared by
// everyone; a change in the back office shows up within a minute).
// After that minute the old copy keeps being served while a fresh one loads
// in the background, so nobody waits for the reload; only the very first
// visitor to a new server waits for the first load.
const CATALOGUE_TTL_MS = 60_000;
let catalogueCache: { at: number; promise: Promise<Product[]> } | null = null;
let catalogueLast: Product[] | null = null;
let catalogueLoading: Promise<Product[]> | null = null;

function refreshCatalogue(): Promise<Product[]> {
  if (!catalogueLoading) {
    const promise = loadActiveProducts();
    catalogueLoading = promise;
    promise
      .then((products) => {
        catalogueLast = products;
        catalogueCache = { at: Date.now(), promise };
      })
      .catch(() => {})
      .finally(() => {
        if (catalogueLoading === promise) catalogueLoading = null;
      });
  }
  return catalogueLoading;
}

export function getActiveProducts(): Promise<Product[]> {
  if (catalogueCache && Date.now() - catalogueCache.at <= CATALOGUE_TTL_MS) return catalogueCache.promise;
  const loading = refreshCatalogue();
  return catalogueLast ? Promise.resolve(catalogueLast) : loading;
}


/**
 * What a product card needs, without the description and extra images, so
 * pages that list many products send far less to the browser.
 */
export function cardProduct(product: Product): Product {
  return {
    ...product,
    description: "",
    shortDescription: undefined,
    imageUrls: (product.imageUrls || []).slice(0, 2),
    restrictedShippingStates: undefined,
  };
}

async function loadActiveProducts(): Promise<Product[]> {
  try {
    const supabase = await createClient();
    // At most 1000 rows come back per request: count, then fetch the pages
    // side by side instead of one after another.
    const { count, error: countError } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    if (countError) throw countError;
    const pageStarts = Array.from({ length: Math.min(40, Math.ceil((count || 0) / 1000) + 1) }, (_, i) => i * 1000);
    const pages = await mapLimit(pageStarts, 6, async (from) => {
      const page = await withShopFallback((select) =>
        supabase
          .from("products")
          .select(select)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, from + 999)
      );
      if (page.error) throw page.error;
      return (page.data || []) as unknown[];
    });
    const seen = new Set<string>();
    const data = pages.flat().filter((row) => {
      const id = (row as { id?: string }).id || "";
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    const live = (data as unknown as ProductRow[])
      .map(mapProduct)
      .filter((product): product is Product => Boolean(product))
      // Long Shopee descriptions aren't needed in lists (search uses the start).
      .map((product) => ({ ...product, description: (product.description || "").slice(0, 600) }));

    return live.length > 0
      ? await attachFitmentLevels(await attachReviewStats(live))
      : demoProducts;
  } catch {
    return demoProducts;
  }
}

export async function getActiveProductBySlug(
  slug: string
): Promise<Product | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await withShopFallback((select) =>
      supabase
        .from("products")
        .select(select)
        .eq("slug", slug)
        .eq("status", "active")
        .limit(1)
    );

    if (error) throw error;

    const row = ((data as unknown[] | null)?.[0] || null) as ProductRow | null;
    const mapped = row ? mapProduct(row) : null;

    if (mapped) {
      const [withReviews] = await attachFitmentLevels(await attachReviewStats([mapped]));
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

/** Reviewer names (masked when anonymous) from supabase/review-names.sql. */
async function attachReviewerNames(reviews: ProductPublicReview[]): Promise<ProductPublicReview[]> {
  if (!reviews.length) return reviews;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("product_review_names", {
      p_ids: reviews.map((review) => review.id),
    });
    if (error || !data) return reviews;
    const names = new Map(
      (data as Array<{ id: string; display_name: string | null }>).map((row) => [row.id, row.display_name])
    );
    return reviews.map((review) => ({ ...review, reviewerName: names.get(review.id) || null }));
  } catch {
    return reviews;
  }
}

export async function getProductPublicReviewsWithNames(
  productId: string
): Promise<ProductPublicReview[]> {
  return attachReviewerNames(await getProductPublicReviews(productId));
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
        .select(shopColumnsAvailable ? selectQuery : legacySelectQuery)
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
