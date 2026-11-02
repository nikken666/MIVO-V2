export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import ShopBadge from "@/components/ShopBadge";
import { getActiveProducts } from "@/lib/catalog";
import { getShops, shopPath } from "@/lib/shops";

export const metadata: Metadata = {
  title: "Shops | MIVO",
  description: "Browse official MIVO Direct and partner auto-parts shops on MIVO.",
  alternates: { canonical: "/shops" },
};

export default async function ShopsPage() {
  const [shops, products] = await Promise.all([getShops(), getActiveProducts()]);

  const countFor = (shop: { id: string; name: string }) =>
    products.filter((p) => (p.sellerId ? p.sellerId === shop.id : p.seller === shop.name)).length;

  return (
    <main className="shopsPage">
      <div className="container">
        <header className="shopsHero">
          <span>MIVO marketplace</span>
          <h1>Shops</h1>
          <p>Every shop ships from the MIVO warehouse. Look for the MIVO Direct badge for official stock.</p>
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
                <small>{shop.tagline || shop.description || "Auto parts shipped from the MIVO warehouse"}</small>
                <span className="shopsCardFoot">
                  {countFor(shop)} products <b>Visit ›</b>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="shopsEmpty">No shops are open yet.</p>
        )}
      </div>
    </main>
  );
}
