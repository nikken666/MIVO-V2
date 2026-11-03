export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import ShopVouchers from "@/components/ShopVouchers";
import Link from "next/link";
import { notFound } from "next/navigation";
import ChatNowButton from "@/components/chat/ChatNowButton";
import ProductCard from "@/components/ProductCard";
import ShopBadge from "@/components/ShopBadge";
import { getActiveProducts } from "@/lib/catalog";
import { getShop } from "@/lib/shops";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShop(decodeURIComponent(slug));
  if (!shop) return {};
  const t = await getT();
  return {
    title: shop.name + " | MIVO",
    description: shop.tagline || shop.description || t("browse.shop.metaDesc", { shop: shop.name }),
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
  const t = await getT();
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
            <p>{shop.tagline || shop.description || t("browse.shop.heroFallback")}</p>
            <div className="shopPageStats">
              <span><b>{all.length}</b> {t("browse.shop.products")}</span>
              <span><b>{categories.length}</b> {t("browse.shop.categories")}</span>
              <span>{shop.tier === "direct" ? t("browse.shop.shipsFrom") : t("browse.shop.shipsOwn")}</span>
            </div>
            <div className="shopPageActions">
              <ChatNowButton sellerId={shop.id} />
            </div>
            <ShopVouchers sellerId={shop.id} />
          </div>
          <form className="shopPageSearch" action={base}>
            <input name="q" defaultValue={q} placeholder={t("browse.shop.searchIn", { shop: shop.name })} />
            <button type="submit">{t("browse.search")}</button>
          </form>
        </div>
      </section>

      <div className="container shopPageBody">
        <nav className="shopChips" aria-label={t("browse.shop.categoriesAria")}>
          <Link href={base} className={"shopChip" + (!activeCategory ? " active" : "")}>{t("browse.shop.all")}</Link>
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
          <p className="shopsEmpty">{t("browse.shop.empty")}</p>
        )}
      </div>
    </main>
  );
}
