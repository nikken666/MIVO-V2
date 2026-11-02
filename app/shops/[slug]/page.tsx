export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ChatNowButton from "@/components/chat/ChatNowButton";
import ProductCard from "@/components/ProductCard";
import ShopBadge from "@/components/ShopBadge";
import { getActiveProducts } from "@/lib/catalog";
import { getShop } from "@/lib/shops";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShop(decodeURIComponent(slug));
  if (!shop) return {};
  return {
    title: shop.name + " | MIVO",
    description: shop.tagline || shop.description || shop.name + " on MIVO.",
  };
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const shop = await getShop(decodeURIComponent(slug));
  if (!shop) notFound();

  const all = (await getActiveProducts()).filter((p) =>
    p.sellerId ? p.sellerId === shop.id : p.seller === shop.name
  );

  const categories = Array.from(new Set(all.map((p) => p.category))).sort();
  const activeCategory = typeof query.category === "string" ? query.category : "";
  const q = typeof query.q === "string" ? query.q.trim().toLowerCase() : "";
  const shown = all.filter(
    (p) =>
      (!activeCategory || p.category === activeCategory) &&
      (!q || (p.name + " " + p.brand).toLowerCase().includes(q))
  );
  const base = "/shops/" + encodeURIComponent(shop.slug || shop.id);

  return (
    <main className="shopPage">
      <section className={"shopPageHero tier-" + shop.tier}>
        {shop.bannerUrl ? <img className="shopPageBanner" src={shop.bannerUrl} alt="" /> : null}
        <div className="container shopPageHeroInner">
          <span className="shopPageAvatar" aria-hidden="true">
            {shop.logoUrl ? <img src={shop.logoUrl} alt="" /> : shop.name.slice(0, 1)}
          </span>
          <div>
            <h1>
              {shop.name} <ShopBadge tier={shop.tier} size="md" />
            </h1>
            <p>{shop.tagline || shop.description || "Ships from the MIVO warehouse."}</p>
            <div className="shopPageStats">
              <span><b>{all.length}</b> products</span>
              <span><b>{categories.length}</b> categories</span>
              <span>Ships from MIVO warehouse</span>
            </div>
            <div className="shopPageActions">
              <ChatNowButton sellerId={shop.id} />
            </div>
          </div>
          <form className="shopPageSearch" action={base}>
            <input name="q" defaultValue={q} placeholder={"Search in " + shop.name} />
            <button type="submit">Search</button>
          </form>
        </div>
      </section>

      <div className="container shopPageBody">
        <nav className="shopChips" aria-label="Shop categories">
          <Link href={base} className={"shopChip" + (!activeCategory ? " active" : "")}>All</Link>
          {categories.map((category) => (
            <Link
              key={category}
              href={base + "?category=" + encodeURIComponent(category)}
              className={"shopChip" + (activeCategory === category ? " active" : "")}
            >
              {category}
            </Link>
          ))}
        </nav>

        {shown.length ? (
          <div className="shopDiscoverGrid">
            {shown.map((product) => (
              <ProductCard product={product} compact key={product.slug} />
            ))}
          </div>
        ) : (
          <p className="shopsEmpty">No products match in this shop yet.</p>
        )}
      </div>
    </main>
  );
}
