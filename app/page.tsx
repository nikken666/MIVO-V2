import Link from "next/link";
import type { ReactNode } from "react";
import { getActiveProducts } from "@/lib/catalog";
import ProductCard from "@/components/ProductCard";
import HomePromotions from "@/components/HomePromotions";
import HomeBannerCarousel from "@/components/HomeBannerCarousel";
import FlashSale from "@/components/FlashSale";
import VehiclePickerButton from "@/components/VehiclePickerButton";
import { products } from "@/data/products";

const categories = [
  { name: "Maintenance", short: "Oil & filters", href: "/products?group=maintenance" },
  { name: "Braking", short: "Brakes", href: "/products?group=braking" },
  { name: "Suspension", short: "Suspension", href: "/products?group=suspension" },
  { name: "Steering", short: "Steering", href: "/products?group=steering" },
  { name: "Drivetrain", short: "Drivetrain", href: "/products?group=drivetrain" },
  { name: "Cooling", short: "Cooling", href: "/products?group=cooling" },
  { name: "Vouchers", short: "Vouchers", href: "/account/vouchers" },
  { name: "All", short: "All parts", href: "/products" },
];

// Line icons (24px grid, stroked with currentColor) for the category row.
const categoryIcons: Record<string, ReactNode> = {
  Maintenance: <path d="M12 3c3.4 4.3 5.5 7 5.5 9.6a5.5 5.5 0 0 1-11 0C6.5 10 8.6 7.3 12 3zM9.5 13.5a2.5 2.5 0 0 0 2.5 2.5" />,
  Braking: (
    <>
      <circle cx="11" cy="13" r="8" />
      <circle cx="11" cy="13" r="2.6" />
      <path d="M15.5 4.6a9 9 0 0 1 4.9 5.6" strokeWidth="3.2" />
    </>
  ),
  Suspension: <path d="M12 2v3M12 19v3M7 6.5l10 2-10 2 10 2-10 2 10 2" />,
  Steering: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M3.4 10.6l6.1 1M14.5 11.6l6.1-1M12 14.6V21" />
    </>
  ),
  Drivetrain: (
    <>
      <path d="M6 12h12" />
      <rect x="2" y="9" width="4" height="6" rx="1.6" />
      <rect x="18" y="9" width="4" height="6" rx="1.6" />
      <path d="M7.5 9.5l2.5 1v3l-2.5 1M16.5 9.5l-2.5 1v3l2.5 1" />
    </>
  ),
  Cooling: (
    <>
      <circle cx="12" cy="12" r="1.8" />
      <path d="M12 10.2C11.4 6 12.6 3 15.4 3c2.2 0 2.4 3.6-3.4 7.2zM13.8 12c4.2-.6 7.2.6 7.2 3.4 0 2.2-3.6 2.4-7.2-3.4zM12 13.8c.6 4.2-.6 7.2-3.4 7.2-2.2 0-2.4-3.6 3.4-7.2zM10.2 12C6 12.6 3 11.4 3 8.6 3 6.4 6.6 6.2 10.2 12z" />
    </>
  ),
  Vouchers: (
    <>
      <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" />
      <path d="M9.5 14.5l5-5M9.6 9.6h.01M14.4 14.4h.01" />
    </>
  ),
  All: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.8" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" />
    </>
  ),
};

const brandLogos = [
  { name: "KYB", logo: "/brands/kyb-logo.svg" },
  { name: "NIKKEN", logo: "/brands/nikken-logo.svg" },
  { name: "GSP", logo: "/brands/gsp-logo.svg" },
];

const DISCOVER_COUNT = 20;

export default async function HomePage() {
  const liveProducts = await getActiveProducts();
  const catalogue = liveProducts.length ? liveProducts : products;

  // Daily discover: a varied mix (max 3 per category first, then fill up).
  const discover: typeof catalogue = [];
  const perCategory = new Map<string, number>();
  const picked = new Set<string>();
  for (const product of catalogue) {
    const category = product.category || "Other";
    const count = perCategory.get(category) || 0;
    if (count >= 3 || picked.has(product.slug)) continue;
    discover.push(product);
    picked.add(product.slug);
    perCategory.set(category, count + 1);
    if (discover.length === DISCOVER_COUNT) break;
  }
  for (const product of catalogue) {
    if (discover.length >= DISCOVER_COUNT) break;
    if (picked.has(product.slug)) continue;
    discover.push(product);
    picked.add(product.slug);
  }

  return (
    <main className="home shopHome">
      {/* Banners: big carousel + two side banners */}
      <section className="container shopHero">
        <HomeBannerCarousel />
        <div className="shopSideBanners">
          <VehiclePickerButton variant="banner" />
          <Link href="/products?view=brands" className="shopSideBanner shopSideBannerBrands">
            <span className="shopSideBannerKicker">Official brands</span>
            <strong>Shop by brand</strong>
            <span className="shopBrandRow">
              {brandLogos.map((brand) => (
                <img src={brand.logo} alt={brand.name} key={brand.name} />
              ))}
            </span>
            <span className="shopSideBannerCta">View brands ›</span>
          </Link>
        </div>
      </section>

      {/* Category icons */}
      <section className="container shopSection">
        <nav className="shopCategories" aria-label="Shop by category">
          {categories.map((cat) => (
            <Link href={cat.href} className={"shopCategory" + (cat.name === "Vouchers" ? " isVoucher" : "")} key={cat.name}>
              <span className="shopCategoryIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24">{categoryIcons[cat.name]}</svg>
              </span>
              <span>{cat.short}</span>
            </Link>
          ))}
        </nav>
      </section>

      <HomePromotions products={catalogue} only="vouchers" />

      <FlashSale products={catalogue} />

      {/* Daily discover */}
      <section className="container shopSection" id="discover">
        <div className="shopSectionHead">
          <h2>Daily discover</h2>
          <div className="shopChips" role="list">
            <span className="shopChip active" role="listitem">All parts</span>
            <Link href="/products" className="shopChip" role="listitem">Fits my car</Link>
            <Link href="/products?group=suspension" className="shopChip" role="listitem">Suspension</Link>
            <Link href="/products?group=steering" className="shopChip" role="listitem">Steering</Link>
          </div>
        </div>
        <div className="shopDiscoverGrid">
          {discover.map((product) => (
            <ProductCard product={product} compact key={product.slug} />
          ))}
        </div>
        <div className="shopMore">
          <Link href="/products" className="btn btnLight">See more parts</Link>
        </div>
      </section>

      {/* Why MIVO */}
      <section className="container shopSection">
        <div className="shopTrust">
          <div>
            <span className="shopTrustIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16.5 9.5" /></svg>
            </span>
            <strong>Fitment checked</strong>
            <small>Parts matched to your exact car</small>
          </div>
          <div>
            <span className="shopTrustIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>
            </span>
            <strong>Malaysia-wide delivery</strong>
            <small>Tracked from our warehouse to you</small>
          </div>
          <div>
            <span className="shopTrustIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
            </span>
            <strong>Warranty included</strong>
            <small>Claim online from your orders</small>
          </div>
          <div>
            <span className="shopTrustIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M7 15h4" /></svg>
            </span>
            <strong>Secure checkout</strong>
            <small>Card payments by Stripe</small>
          </div>
        </div>
      </section>
    </main>
  );
}
