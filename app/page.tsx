import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { getActiveProducts } from "@/lib/catalog";
import ProductCard from "@/components/ProductCard";
import Logo from "@/components/Logo";
import VehicleFinder from "@/components/VehicleFinder";
import HomeGarageManage from "@/components/HomeGarageManage";
import HomePromotions from "@/components/HomePromotions";
import { products } from "@/data/products";

const categories = [
  { name: "Maintenance", desc: "Oil, ATF, coolant & filters" },
  { name: "Braking", desc: "Pads, rotors & repair kits" },
  { name: "Suspension", desc: "Absorbers, mounts & springs" },
  { name: "Steering", desc: "Racks, rack ends & tie rods" },
  { name: "Drivetrain", desc: "Shafts, CV joints & hubs" },
  { name: "Cooling", desc: "Radiators, pumps & thermostats" },
];

// Line icons (24px grid, stroked with currentColor) for the category tiles.
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
};

const brands = [
  { name: "NIKKEN", logo: "/brands/nikken-logo.svg" },
  { name: "KYB", logo: "/brands/kyb-logo.svg" },
  { name: "GSP", logo: "/brands/gsp-logo.svg" },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const addVehicle =
    typeof query.addVehicle === "string" && query.addVehicle === "1";

  let signedIn = false;
  let savedVehicle:
    | {
        make: string | null;
        model: string | null;
        generation: string | null;
        year: string | null;
        variant: string | null;
        transmission: string | null;
      }
    | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    signedIn = Boolean(user);

    if (user) {
      const { data } = await supabase
        .from("customer_vehicles")
        .select("make, model, generation, year, variant, transmission")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      savedVehicle = data || null;
    }
  } catch {}

  const liveProducts = await getActiveProducts();
  const catalogue = liveProducts.length ? liveProducts : products;
  const featured: typeof catalogue = [];
  const categoryCounts = new Map<string, number>();
  const selectedSlugs = new Set<string>();
  for (const product of catalogue) {
    const category = product.category || "Other";
    const count = categoryCounts.get(category) || 0;
    if (count >= 2 || selectedSlugs.has(product.slug)) continue;
    featured.push(product);
    selectedSlugs.add(product.slug);
    categoryCounts.set(category, count + 1);
    if (featured.length === 8) break;
  }
  if (featured.length < 8) {
    for (const product of catalogue) {
      if (selectedSlugs.has(product.slug)) continue;
      featured.push(product);
      selectedSlugs.add(product.slug);
      if (featured.length === 8) break;
    }
  }

  const savedVehicleLabel = savedVehicle
    ? [
        savedVehicle.make,
        savedVehicle.model,
        savedVehicle.generation,
        savedVehicle.year,
        savedVehicle.variant,
        savedVehicle.transmission,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <main className="home">
      {signedIn && !addVehicle ? (
        <section className="memberHomeHero">
          <div className="container memberHomeHeroGrid">
            <div className="memberHomePromo">
              <span className="memberHomeEyebrow">Your automotive store</span>
              <h1>Welcome back.</h1>
              <p>
                Shop parts, manage your vehicle and keep track of every order
                from one place.
              </p>
              <div className="memberHomeActions">
                <Link href="/products" className="btn btnLight">
                  Shop parts
                </Link>
                <Link href="/orders" className="btn btnGhost">
                  My orders
                </Link>
              </div>
            </div>

            <div className="memberGarageCard">
              <div className="memberGarageHead">
                <div>
                  <span>My Garage</span>
                  <strong>
                    {savedVehicle
                      ? [savedVehicle.make, savedVehicle.model]
                          .filter(Boolean)
                          .join(" ")
                      : "No vehicle selected"}
                  </strong>
                </div>
                <HomeGarageManage />
              </div>

              {savedVehicle ? (
                <>
                  <p>{savedVehicleLabel}</p>
                  <Link href="/products" className="memberGarageShop">
                    Shop compatible parts
                  </Link>
                </>
              ) : (
                <>
                  <p>Add your vehicle once and MIVO will prioritise compatible parts.</p>
                  <Link href="/?addVehicle=1#fitment" className="memberGarageShop">
                    Add a vehicle
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="hero">
          <div className="heroTexture" />
          <Logo variant="watermark" className="heroLogoWatermark" decorative />
          <div className="container heroGrid">
            <div className="heroCopy">
              <span className="heroEyebrow">Premium automotive parts</span>
              <h1>The right part.<br /><em>Without the guesswork.</em></h1>
              <p>
                Shop trusted automotive parts through a cleaner, more precise buying experience —
                built around your vehicle, not endless listings.
              </p>
              <div className="heroButtons">
                <a href="#fitment" className="btn btnLight">Find parts for my car</a>
                <Link href="/products" className="btn btnGhost">Browse all parts</Link>
              </div>
              <div className="heroProof">
                <span><b>01</b> Vehicle-matched catalogue</span>
                <span><b>02</b> Trusted brands & clear specs</span>
                <span><b>03</b> Malaysia-wide delivery</span>
              </div>
            </div>

            <VehicleFinder />
          </div>
        </section>
      )}

      <section className="trustBar">
        <div className="container trustBarInner">
          <span><i></i> Fitment-focused shopping</span>
          <span><i></i> Curated automotive brands</span>
          <span><i></i> Secure checkout</span>
          <span><i></i> Malaysia-wide delivery</span>
        </div>
      </section>

      <HomePromotions products={liveProducts.length ? liveProducts : products} />

      <section className="section categorySection">
        <div className="container">
          <div className="sectionHeader">
            <div><span className="sectionEyebrow">Shop by system</span><h2>Parts, organised the way<br />cars are built.</h2></div>
            <Link href="/products" className="sectionLink">View all categories ›</Link>
          </div>

          <div className="categoryTiles">
            {categories.map((cat) => (
              <Link
                href={"/products?group=" + cat.name.toLowerCase()}
                className="categoryTile"
                key={cat.name}
              >
                <span className="categoryTileIcon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">{categoryIcons[cat.name]}</svg>
                </span>
                <strong>{cat.name}</strong>
                <small>{cat.desc}</small>
                <span className="categoryTileGo" aria-hidden="true">Shop ›</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section productsSection">
        <div className="container">
          <div className="sectionHeader productHeader">
            <div><span className="sectionEyebrow">Selected for you</span><h2>Popular parts.</h2></div>
            <div className="productHeaderSide">
              <p>Clean product information, clear pricing and fitment-led discovery.</p>
              <Link href="/products" className="sectionLink">Shop all parts ›</Link>
            </div>
          </div>
          <div className="featuredGrid">
            {featured.map((product) => <ProductCard product={product} compact key={product.slug} />)}
          </div>
        </div>
      </section>

      <section className="brandBand">
        <div className="container">
          <div className="brandBandTop"><span>Trusted names. One clean catalogue.</span><Link href="/brands">Explore brands ›</Link></div>
          <div className="brandGrid brandLogoGrid">
            {brands.map((brand) => (
              <div className="brandLogoCard brandLogoCardStatic" key={brand.name} aria-label={brand.name}>
                <img src={brand.logo} alt={brand.name} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section standardSection" id="standard">
        <div className="container standardGrid">
          <div className="standardIntro">
            <span className="sectionEyebrow">The MIVO standard</span>
            <h2>Less clutter.<br />More certainty.</h2>
            <p>MIVO is designed around the questions that matter before buying a part: Will it fit? What exactly am I buying? Who made it? When will it arrive?</p>
            <Link href="/products" className="btn btnDark">Explore the catalogue</Link>
          </div>
          <div className="standardCards">
            <article><span>01</span><div className="standardIcon standardIconCheck" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M6 17l6 6L26 8"/></svg></div><h3>Fitment clarity</h3><p>Vehicle compatibility is treated as core product data, not an afterthought.</p></article>
            <article><span>02</span><div className="standardIcon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 4L28 16 16 28 4 16Z"/></svg></div><h3>Product transparency</h3><p>Brand, specification, variant and product information are easy to understand.</p></article>
            <article><span>03</span><div className="standardIcon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M8 24L24 8M13 8h11v11"/></svg></div><h3>Built for repeat buyers</h3><p>Save vehicles to My Garage and return to a catalogue already tailored to you.</p></article>
            <article><span>04</span><div className="standardIcon" aria-hidden="true"><svg viewBox="0 0 32 32"><rect x="6" y="6" width="20" height="20"/></svg></div><h3>Professional checkout</h3><p>A focused path from fitment to product to payment — without marketplace noise.</p></article>
          </div>
        </div>
      </section>

      <section className="garageCtaSection">
        <div className="container garageCta">
          <div>
            <span className="microLabel">MIVO Garage</span>
            <h2>Your car becomes<br />your storefront.</h2>
          </div>
          <div className="garageCtaCopy">
            <p>Save your vehicle and make every return visit faster. Compatible parts first. Irrelevant listings out of the way.</p>
            <Link href="/garage" className="btn btnLight">Open My Garage</Link>
          </div>
        </div>
      </section>
    </main>
  );
}