import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveProducts } from "@/lib/catalog";
import ProductCard from "@/components/ProductCard";
import Logo from "@/components/Logo";
import VehicleFinder from "@/components/VehicleFinder";
import HomePromotions from "@/components/HomePromotions";
import { products } from "@/data/products";

const categories = [
  { name: "Maintenance", desc: "Engine oil, ATF, coolant & filters", mark: "M", tone: "warm" },
  { name: "Braking", desc: "Brake pads, rotors & repair kits", mark: "B", tone: "dark" },
  { name: "Suspension", desc: "Absorbers, mounts, arms & springs", mark: "S", tone: "silver" },
  { name: "Steering", desc: "EPS racks, rack ends & tie rods", mark: "R", tone: "graphite" },
  { name: "Drivetrain", desc: "Drive shafts, CV joints & hubs", mark: "D", tone: "warm" },
  { name: "Cooling", desc: "Radiators, pumps & thermostats", mark: "C", tone: "silver" },
];

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
        .eq("is_default", true)
        .maybeSingle();

      savedVehicle = data || null;
    }
  } catch {}

  const liveProducts = await getActiveProducts();
  const featured = (liveProducts.length ? liveProducts : products).slice(0, 8);

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
              <span className="memberHomeEyebrow">MIVO · YOUR AUTOMOTIVE STORE</span>
              <h1>WELCOME BACK.</h1>
              <p>
                Shop parts, manage your vehicle and keep track of every order
                from one place.
              </p>
              <div className="memberHomeActions">
                <Link href="/products" className="btn btnLight">
                  SHOP PARTS <span>→</span>
                </Link>
                <Link href="/orders" className="btn btnGhost">
                  MY ORDERS
                </Link>
              </div>
            </div>

            <div className="memberGarageCard">
              <div className="memberGarageHead">
                <div>
                  <span>MY GARAGE</span>
                  <strong>
                    {savedVehicle
                      ? [savedVehicle.make, savedVehicle.model]
                          .filter(Boolean)
                          .join(" ")
                      : "No vehicle selected"}
                  </strong>
                </div>
                <Link href="/garage">MANAGE →</Link>
              </div>

              {savedVehicle ? (
                <>
                  <p>{savedVehicleLabel}</p>
                  <Link href="/products" className="memberGarageShop">
                    SHOP COMPATIBLE PARTS <span>→</span>
                  </Link>
                </>
              ) : (
                <>
                  <p>Add your vehicle once and MIVO will prioritise compatible parts.</p>
                  <Link href="/?addVehicle=1#fitment" className="memberGarageShop">
                    + ADD VEHICLE <span>→</span>
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
              <span className="heroEyebrow">PREMIUM AUTOMOTIVE PARTS · MALAYSIA</span>
              <h1>THE RIGHT PART.<br /><em>WITHOUT THE GUESSWORK.</em></h1>
              <p>
                Shop trusted automotive parts through a cleaner, more precise buying experience —
                built around your vehicle, not endless listings.
              </p>
              <div className="heroButtons">
                <a href="#fitment" className="btn btnLight">Find parts for my car <span>→</span></a>
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
          <span><i></i> FITMENT-FOCUSED SHOPPING</span>
          <span><i></i> CURATED AUTOMOTIVE BRANDS</span>
          <span><i></i> SECURE CHECKOUT</span>
          <span><i></i> MALAYSIA DELIVERY</span>
        </div>
      </section>

      <HomePromotions products={liveProducts.length ? liveProducts : products} />

      <section className="section categorySection">
        <div className="container">
          <div className="sectionHeader">
            <div><span className="sectionEyebrow">SHOP BY SYSTEM</span><h2>Parts, organised the way<br />cars are built.</h2></div>
            <Link href="/products" className="sectionLink">VIEW ALL CATEGORIES</Link>
          </div>

          <div className="categoryGrid">
            {categories.map((cat, index) => (
              <Link
                href={"/products?group=" + cat.name.toLowerCase()}
                className={"categoryCard " + cat.tone}
                key={cat.name}
              >
                <div className="categoryVisual">
                  <span className="categoryIndex">0{index + 1}</span>
                  <strong>{cat.mark}</strong>
                  <i />
                </div>
                <div className="categoryCopy">
                  <h3>{cat.name}</h3>
                  <p>{cat.desc}</p>
                  <span>Shop category</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section productsSection">
        <div className="container">
          <div className="sectionHeader productHeader">
            <div><span className="sectionEyebrow">SELECTED FOR MIVO</span><h2>Popular parts.</h2></div>
            <div className="productHeaderSide">
              <p>Clean product information, clear pricing and fitment-led discovery.</p>
              <Link href="/products" className="sectionLink">SHOP ALL PARTS <span>→</span></Link>
            </div>
          </div>
          <div className="featuredGrid">
            {featured.map((product) => <ProductCard product={product} compact key={product.slug} />)}
          </div>
        </div>
      </section>

      <section className="brandBand">
        <div className="container">
          <div className="brandBandTop"><span>TRUSTED NAMES. ONE CLEAN CATALOGUE.</span><Link href="/brands">EXPLORE BRANDS </Link></div>
          <div className="brandGrid brandLogoGrid">
            {brands.map((brand) => (
              <Link href="/products?view=brands" className="brandLogoCard" key={brand.name} aria-label={brand.name}>
                <img src={brand.logo} alt={brand.name} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section standardSection" id="standard">
        <div className="container standardGrid">
          <div className="standardIntro">
            <span className="sectionEyebrow">THE MIVO STANDARD</span>
            <h2>Less clutter.<br />More certainty.</h2>
            <p>MIVO is designed around the questions that matter before buying a part: Will it fit? What exactly am I buying? Who made it? When will it arrive?</p>
            <Link href="/products" className="btn btnDark">Explore the catalogue <span>→</span></Link>
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
            <span className="microLabel">MIVO GARAGE</span>
            <h2>Your car becomes<br />your storefront.</h2>
          </div>
          <div className="garageCtaCopy">
            <p>Save your vehicle and make every return visit faster. Compatible parts first. Irrelevant listings out of the way.</p>
            <Link href="/garage" className="btn btnLight">OPEN MY GARAGE <span>→</span></Link>
          </div>
        </div>
      </section>
    </main>
  );
}