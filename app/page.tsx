import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import Logo from "@/components/Logo";
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

export default function HomePage() {
  const featured = products.slice(0, 8);

  return (
    <main className="home">
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

          <div className="fitmentCard" id="fitment">
            <div className="fitmentCardTop">
              <div>
                <span className="microLabel">MIVO VEHICLE MATCH</span>
                <h2>Find parts that fit.</h2>
              </div>
              <span className="fitmentBadge">BETA</span>
            </div>
            <p className="fitmentIntro">Select your vehicle once. MIVO will narrow the catalogue around it.</p>

            <div className="fitmentForm">
              <label>
                <span>Make</span>
                <select defaultValue="">
                  <option value="" disabled>Select make</option>
                  <option>Perodua</option><option>Proton</option><option>Toyota</option><option>Honda</option><option>Nissan</option>
                </select>
              </label>
              <label>
                <span>Model</span>
                <select defaultValue="">
                  <option value="" disabled>Select model</option>
                  <option>Myvi</option><option>Bezza</option><option>Saga</option><option>City</option><option>Vios</option>
                </select>
              </label>
              <div className="fitmentSplit">
                <label>
                  <span>Year</span>
                  <select defaultValue="">
                    <option value="" disabled>Year</option>
                    <option>2026</option><option>2025</option><option>2024</option><option>2023</option>
                  </select>
                </label>
                <label>
                  <span>Variant / Engine</span>
                  <select defaultValue="">
                    <option value="" disabled>Variant</option>
                    <option>1.3</option><option>1.5</option><option>2.0</option>
                  </select>
                </label>
              </div>
              <button type="button" className="fitmentSubmit">SHOW COMPATIBLE PARTS <span>→</span></button>
            </div>

            <div className="garagePrompt">
              <div className="garageIcon">+</div>
              <div><strong>Already saved a car?</strong><small>Open My Garage and continue shopping.</small></div>
              <Link href="/garage">Open Garage</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="trustBar">
        <div className="container trustBarInner">
          <span><i>✓</i> FITMENT-FOCUSED SHOPPING</span>
          <span><i>✓</i> CURATED AUTOMOTIVE BRANDS</span>
          <span><i>✓</i> SECURE CHECKOUT</span>
          <span><i>✓</i> MALAYSIA DELIVERY</span>
        </div>
      </section>

      <section className="section categorySection">
        <div className="container">
          <div className="sectionHeader">
            <div><span className="sectionEyebrow">SHOP BY SYSTEM</span><h2>Parts, organised the way<br />cars are built.</h2></div>
            <Link href="/products" className="sectionLink">VIEW ALL CATEGORIES <span>↗</span></Link>
          </div>

          <div className="categoryGrid">
            {categories.map((cat, index) => (
              <Link href="/products" className={"categoryCard " + cat.tone} key={cat.name}>
                <div className="categoryVisual">
                  <span className="categoryIndex">0{index + 1}</span>
                  <strong>{cat.mark}</strong>
                  <i />
                </div>
                <div className="categoryCopy">
                  <h3>{cat.name}</h3>
                  <p>{cat.desc}</p>
                  <span>Shop category ↗</span>
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
          <div className="brandBandTop"><span>TRUSTED NAMES. ONE CLEAN CATALOGUE.</span><Link href="/brands">EXPLORE BRANDS ↗</Link></div>
          <div className="brandGrid brandLogoGrid">
            {brands.map((brand) => (
              <Link href="/brands" className="brandLogoCard" key={brand.name} aria-label={brand.name}>
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
            <article><span>01</span><div className="standardIcon">✓</div><h3>Fitment clarity</h3><p>Vehicle compatibility is treated as core product data, not an afterthought.</p></article>
            <article><span>02</span><div className="standardIcon">◇</div><h3>Product transparency</h3><p>Brand, specification, variant and product information are easy to understand.</p></article>
            <article><span>03</span><div className="standardIcon">↗</div><h3>Built for repeat buyers</h3><p>Save vehicles to My Garage and return to a catalogue already tailored to you.</p></article>
            <article><span>04</span><div className="standardIcon">□</div><h3>Professional checkout</h3><p>A focused path from fitment to product to payment — without marketplace noise.</p></article>
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