import Link from "next/link";

const categories = [
  ["🛢️", "Maintenance"],
  ["⚙️", "Engine"],
  ["🔩", "Suspension"],
  ["🛞", "Braking"],
  ["◉", "Steering"],
  ["▦", "Cooling"],
  ["🔋", "Electrical"],
  ["◒", "Body Parts"],
  ["💺", "Interior"],
  ["🧰", "Tools & Garage"],
  ["◉", "Tyres & Wheels"],
  ["▦", "View All"],
];

const products = [
  { icon: "🔩", name: "KYB Excel-G Front Absorber Set", brand: "KYB", price: "RM 248.00", reviews: "128" },
  { icon: "▰", name: "NIKKEN Brake Pad (Front)", brand: "NIKKEN", price: "RM 89.00", reviews: "96" },
  { icon: "⚙️", name: "GSP Drive Shaft (RH)", brand: "GSP", price: "RM 320.00", reviews: "74" },
  { icon: "✦", name: "DENSO Iridium Spark Plug", brand: "DENSO", price: "RM 28.00", reviews: "187" },
  { icon: "◉", name: "AISIN Water Pump", brand: "AISIN", price: "RM 205.00", reviews: "64" },
  { icon: "🛢️", name: "Shell Helix HX7 5W-30 (4L)", brand: "SHELL", price: "RM 125.00", reviews: "112" },
];

const benefits = [
  ["✓", "100% Fitment Guarantee", "Right part for your vehicle"],
  ["◇", "Genuine & Quality Parts", "Trusted brands only"],
  ["▱", "Fast Delivery", "Nationwide shipping"],
  ["▣", "Secure Payment", "Multiple payment options"],
  ["⌘", "Install at Partner Garages", "700+ workshops nationwide"],
];

export default function HomePage() {
  return (
    <main>
      <section className="vehicleSection">
        <div className="container vehiclePanel">
          <div className="vehicleIntro">
            <span className="vehicleIcon">🚘</span>
            <div>
              <strong>SELECT YOUR VEHICLE</strong>
              <small>Find the right parts for your car</small>
            </div>
          </div>
          <label className="selector"><span>Select Brand</span><select defaultValue=""><option value="" disabled>Choose Brand</option><option>Perodua</option><option>Proton</option><option>Toyota</option><option>Honda</option></select></label>
          <label className="selector"><span>Select Model</span><select defaultValue=""><option value="" disabled>Choose Model</option><option>Myvi</option><option>Axia</option><option>Bezza</option><option>Alza</option></select></label>
          <label className="selector"><span>Select Year</span><select defaultValue=""><option value="" disabled>Choose Year</option><option>2026</option><option>2025</option><option>2024</option></select></label>
          <label className="selector"><span>Select Variant</span><select defaultValue=""><option value="" disabled>Choose Variant</option><option>1.3</option><option>1.5</option><option>Auto</option></select></label>
          <button className="redButton">Find Parts</button>
        </div>
      </section>

      <section className="container searchPanel">
        <div className="searchInputWrap"><span>⌕</span><input placeholder="Search by part name, OEM, SKU, or brand..." /><button className="redButton searchButton">Search</button></div>
        <button className="toolButton">⌘ VIN Search <b>New</b></button>
        <button className="toolButton">▣ Plate Number Search <b>New</b></button>
        <button className="toolButton">🚘 My Garage</button>
      </section>

      <section id="categories" className="container categoryPanel">
        {categories.map(([icon, label]) => (
          <Link href="/products" className="categoryItem" key={label}>
            <span className="categoryGraphic">{icon}</span>
            <span>{label}</span>
          </Link>
        ))}
      </section>

      <section id="deals" className="container homeGrid">
        <div className="mainColumn">
          <div className="heroBanner">
            <div className="heroCopy">
              <span className="dealTag">UP TO</span>
              <h1>50% OFF</h1>
              <h2>SHOCK ABSORBER</h2>
              <p>Drive Safe, Drive Confident</p>
              <Link href="/products" className="redButton heroButton">Shop Now →</Link>
            </div>

            <div className="heroParts" aria-hidden="true">
              <span className="shock shockOne">╱│╲</span>
              <span className="shock shockTwo">╱│╲</span>
            </div>

            <img className="heroMascot" src="/mivo-ip.png" alt="MIVO automotive assistant" />
            <div className="sliderDots"><i></i><i></i><i></i><i></i></div>
          </div>

          <div className="sectionTitle">
            <h2>RECOMMENDED FOR YOU</h2>
            <Link href="/products">View All</Link>
          </div>

          <div className="productRow">
            {products.map((product) => (
              <article className="productCard" key={product.name}>
                <div className="productPicture">{product.icon}</div>
                <h3>{product.name}</h3>
                <span className="productBrand">{product.brand}</span>
                <strong>{product.price}</strong>
                <div className="rating">★★★★★ <span>({product.reviews})</span></div>
              </article>
            ))}
          </div>
        </div>

        <aside className="sideColumn">
          <div className="benefitCard">
            <h2>WHY CHOOSE MIVO?</h2>
            {benefits.map(([icon, title, desc]) => (
              <div className="benefit" key={title}>
                <span>{icon}</span>
                <div><strong>{title}</strong><small>{desc}</small></div>
              </div>
            ))}
          </div>

          <div id="services" className="serviceCard">
            <div>
              <h2>BOOK SERVICE</h2>
              <h3>AT PARTNER GARAGE</h3>
              <p>Professional installation<br />Nationwide</p>
              <button className="lightButton">Book Now →</button>
            </div>
            <img src="/mivo-ip.png" alt="MIVO partner garage assistant" />
          </div>
        </aside>
      </section>

      <section className="container promiseStrip">
        <div><span>🚘</span><strong>Find Right Parts</strong><small>Select your vehicle and we’ll show you the right parts</small></div>
        <div><span>◇</span><strong>Wide Selection</strong><small>100,000+ products from trusted brands</small></div>
        <div><span>🏷</span><strong>Best Prices</strong><small>Competitive prices everyday</small></div>
        <div><span>◉</span><strong>Expert Support</strong><small>Our team is here to help you</small></div>
        <div><span>↻</span><strong>Easy Returns</strong><small>7 days return policy, T&amp;C apply</small></div>
      </section>
    </main>
  );
}
