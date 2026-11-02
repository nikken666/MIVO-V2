export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import ShopBadge from "@/components/ShopBadge";
import { getActiveProducts } from "@/lib/catalog";
import { getShops, shopPath } from "@/lib/shops";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("browse.shops.metaTitle"),
    description: t("browse.shops.metaDesc"),
    alternates: { canonical: "/shops" },
  };
}

export default async function ShopsPage() {
  const [shops, products, t] = await Promise.all([getShops(), getActiveProducts(), getT()]);

  const countFor = (shop: { id: string; name: string }) =>
    products.filter((p) => (p.sellerId ? p.sellerId === shop.id : p.seller === shop.name)).length;

  return (
    <main className="shopsPage">
      <div className="container">
        <header className="shopsHero">
          <span>{t("browse.shops.kicker")}</span>
          <h1>{t("browse.shops.title")}</h1>
          <p>{t("browse.shops.intro")}</p>
        </header>

        {shops.length ? (
          <div className="shopsGrid">
            {shops.map((shop) => (
              <Link href={shopPath(shop)} key={shop.id} className={"shopsCard tier-" + shop.tier}>
                <span className="shopsCardBanner" aria-hidden="true">
                  {shop.bannerUrl ? <img src={shop.bannerUrl} alt="" /> : null}
                </span>
                <span className="shopsCardAvatar" aria-hidden="true">
                  {shop.logoUrl ? <img src={shop.logoUrl} alt="" /> : shop.name.slice(0, 1)}
                </span>
                <strong>{shop.name}</strong>
                <ShopBadge tier={shop.tier} size="md" />
                <small>{shop.tagline || shop.description || t("browse.shops.cardFallback")}</small>
                <span className="shopsCardFoot">
                  {t("browse.shops.productsN", { n: countFor(shop) })} <b>{t("browse.shops.visit")}</b>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="shopsEmpty">{t("browse.shops.empty")}</p>
        )}
      </div>
    </main>
  );
}
