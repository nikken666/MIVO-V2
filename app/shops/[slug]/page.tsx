export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import ShopVouchers from "@/components/ShopVouchers";
import Link from "next/link";
import { notFound } from "next/navigation";
import ChatNowButton from "@/components/chat/ChatNowButton";
import ProductCard from "@/components/ProductCard";
import ShopBadge from "@/components/ShopBadge";
import { cardProduct, getActiveProducts } from "@/lib/catalog";
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

  // 48 per page (a shop can have thousands of products).
  const PAGE_SIZE = 48;
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageNumber = Math.min(pageCount, Math.max(1, Math.floor(Number(query.page) || 1)));
  const pageItems = shown.slice((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE).map(cardProduct);
  const pageHref = (n: number) => {
    const next = new URLSearchParams();
    if (activeCategory) next.set("category", activeCategory);
    if (q) next.set("q", q);
    if (n > 1) next.set("page", String(n));
    return base + (next.toString() ? "?" + next.toString() : "");
  };

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
            {pageItems.map((product) => (
              <ProductCard product={product} compact key={product.slug} />
            ))}
          </div>
        ) : (
          <p className="shopsEmpty">{t("browse.shop.empty")}</p>
        )}
        {pageCount > 1 ? (
          <nav className="catalogPager" aria-label={t("browse.products.pages")}>
            <a href={pageHref(Math.max(1, pageNumber - 1))} className={pageNumber === 1 ? "disabled" : ""} aria-label={t("browse.products.prevPage")}>‹</a>
            {Array.from(new Set([1, pageNumber - 1, pageNumber, pageNumber + 1, pageCount]))
              .filter((n) => n >= 1 && n <= pageCount)
              .sort((a, b) => a - b)
              .map((n, index, list) => (
                <span key={n} style={{ display: "contents" }}>
                  {index > 0 && n - list[index - 1] > 1 ? <span className="catalogPagerGap">…</span> : null}
                  <a href={pageHref(n)} className={n === pageNumber ? "active" : ""} aria-current={n === pageNumber ? "page" : undefined}>{n}</a>
                </span>
              ))}
            <a href={pageHref(Math.min(pageCount, pageNumber + 1))} className={pageNumber === pageCount ? "disabled" : ""} aria-label={t("browse.products.nextPage")}>›</a>
          </nav>
        ) : null}
      </div>
    </main>
  );
}
