import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/data/products";
import { mapLimit } from "@/lib/mapLimit";

// How much a product's vehicle fitment can be trusted:
//   verified – MIVO Direct, or another shop's listing checked by MIVO staff
//   seller   – the shop entered compatible vehicles; MIVO hasn't checked
//   none     – no fitment data
export type FitmentLevel = "verified" | "seller" | "none";

export async function attachFitmentLevels(products: Product[]): Promise<Product[]> {
  const ids = products.map((p) => p.id).filter((id): id is string => Boolean(id));
  if (!ids.length) return products;
  const verified = new Set<string>();
  const withData = new Set<string>();
  try {
    const supabase = await createClient();
    // fitment_verified exists once supabase/fitment-verification.sql has run.
    // Chunks are fetched side by side (thousands of products).
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 300) chunks.push(ids.slice(i, i + 300));
    await mapLimit(chunks, 3, async (chunk) => {
      const { data: flags } = await supabase.from("products").select("id, fitment_verified").in("id", chunk);
      for (const row of (flags || []) as Array<{ id: string; fitment_verified: boolean | null }>) {
        if (row.fitment_verified) verified.add(row.id);
      }
    });
    await mapLimit(chunks, 3, async (chunk) => {
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("product_vehicle_fitments")
          .select("product_id")
          .in("product_id", chunk)
          .order("id")
          .range(from, from + 999);
        if (error) break;
        for (const row of (data || []) as Array<{ product_id: string }>) withData.add(row.product_id);
        if (!data || data.length < 1000) break;
      }
    });
  } catch {
    // Keep the catalogue working without levels.
  }
  return products.map((p) => {
    const hasData = Boolean(p.isUniversalFitment || (p.id && withData.has(p.id)));
    const level: FitmentLevel =
      (p.sellerTier === "direct" || (p.id && verified.has(p.id))) && hasData
        ? "verified"
        : hasData
          ? "seller"
          : "none";
    return { ...p, fitmentLevel: level, fitmentVerified: Boolean(p.id && verified.has(p.id)) };
  });
}
