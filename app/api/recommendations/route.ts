import { NextRequest, NextResponse } from "next/server";
import { getActiveProducts } from "@/lib/catalog";
import { getFittingProductIds } from "@/lib/liveFitment";
import { fitmentRank, shopFitmentStatus, type FitmentStatus } from "@/data/fitments";

export const dynamic = "force-dynamic";

// Parts that are often needed together with a category.
const companions: Record<string, string[]> = {
  braking: ["braking", "maintenance"],
  suspension: ["suspension", "steering", "drivetrain"],
  steering: ["steering", "suspension"],
  drivetrain: ["drivetrain", "suspension"],
  cooling: ["cooling", "engine", "maintenance"],
  engine: ["engine", "maintenance", "cooling"],
  maintenance: ["maintenance", "engine", "braking"],
};

/** Parts that fit the shopper's car, for the "recommended for your car" rows. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const vehicleId = q.get("vehicle") || "";
  if (!vehicleId) return NextResponse.json({ items: [] });

  const selected = {
    vehicleId,
    year: q.get("year") || undefined,
    variant: q.get("variant") || undefined,
    transmission: q.get("transmission") || undefined,
  };
  const exclude = new Set((q.get("exclude") || "").split(",").filter(Boolean));
  const context = (q.get("category") || "").toLowerCase();
  const limit = Math.min(12, Math.max(1, Number(q.get("limit")) || 8));

  const [products, { fits, universal }] = await Promise.all([getActiveProducts(), getFittingProductIds(selected)]);

  const related = companions[context] || (context ? [context] : []);
  const items = products
    .filter((p) => p.id && !exclude.has(p.id) && !exclude.has(p.slug) && Number(p.stock ?? 1) > 0)
    .map((p) => {
      const raw: FitmentStatus | null = fits.has(p.id!) ? "fits" : universal.has(p.id!) ? "universal" : null;
      return raw ? { product: p, fitmentStatus: shopFitmentStatus(p, raw) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .map((x) => {
      const cat = x.product.category.toLowerCase();
      const relatedIndex = related.findIndex((c) => cat.includes(c));
      return { ...x, score: (relatedIndex === -1 ? 10 : relatedIndex) * 10 + fitmentRank(x.fitmentStatus) - Math.min(5, Number(x.product.rating || 0)) / 10 };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ product, fitmentStatus }) => ({ product, fitmentStatus }));

  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, max-age=120" } });
}
