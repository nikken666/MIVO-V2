import { NextRequest, NextResponse } from "next/server";
import { getActiveProducts } from "@/lib/catalog";
import { searchProducts } from "@/lib/search";
import { vehicleInQuery } from "@/lib/vehicleTerms";
import { searchShops } from "@/lib/shopSearch";


export async function GET(request: NextRequest) {
  const q = String(request.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ products: [], terms: [], shops: [], vehicle: null });

  // getActiveProducts is cached in memory for a minute (lib/catalog.ts).
  const products = await getActiveProducts();
  const shops = await searchShops(q, products, 2);
  const { items } = searchProducts(products, q);
  const lower = q.toLowerCase();

  // Brand / category names that start with or contain what was typed.
  const terms = Array.from(
    new Set(products.flatMap((p) => [p.brand, p.category]).filter(Boolean))
  )
    .filter((term) => term.toLowerCase().includes(lower))
    .slice(0, 4);

  return NextResponse.json(
    {
      products: items.slice(0, 6).map((p) => ({
        name: p.name,
        slug: p.slug,
        image: p.imageUrl || p.imageUrls?.[0] || null,
        price: p.price,
        shop: p.seller || null,
      })),
      terms,
      shops,
      vehicle: vehicleInQuery(q),
    },
    { headers: { "Cache-Control": "public, max-age=30" } }
  );
}
