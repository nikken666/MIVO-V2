import Link from "next/link";

const categories = [
  ["Maintenance", "Oil, filters & fluids", "01"],
  ["Braking", "Pads, rotors & repair kits", "02"],
  ["Suspension", "Absorbers, arms & springs", "03"],
  ["Steering", "EPS racks & steering parts", "04"],
  ["Drivetrain", "Drive shafts, hubs & CV", "05"],
  ["Cooling", "Radiators, pumps & thermostats", "06"],
];

const brands = ["NIKKEN", "KYB", "DENSO", "BREMBO", "AISIN", "NGK"];

export default function HomePage() {
  return (
    <main>
      <section className="premiumHero">
        <div className="container heroInner">
          <div className="eyebrow">MIVO / PREMIUM AUTOMOTIVE PARTS</div>
          <h1>PARTS.<br/><span>PERFECTLY MATCHED.</span></h1>
          <p className="heroLead">A more precise way to buy automotive parts. Select your vehicle and discover trusted parts matched to it.</p>
          <div className="heroActions">
            <a href="#vehicle" className="primaryCta">SELECT YOUR VEHICLE <span>↗</span></a>
            <Link href="/products" className="textCta">EXPLORE PARTS <span>→</span></Link>
          </div>
          <div className="heroMeta"><span>FITMENT FIRST</span><span>TRUSTED BRANDS</span><span>MALAYSIA DELIVERY</span></div>
        </div>
        <div className="heroOrb" aria-hidden="true"><div className="orbCore">M</div></div>
      </section>

      <section id="vehicle" className="vehicleExperience">
        <div className="container">
          <div className="sectionKicker">01 / VEHICLE FITMENT</div>
          <div className="sectionHead">
            <h2>START WITH<br/>YOUR CAR.</h2>
            <p>MIVO narrows the catalogue around your exact vehicle, so you spend less time guessing and more time choosing the right part.</p>
          </div>
          <div className="vehicleBuilder">
            <label><span>01</span><small>MAKE</small><select defaultValue=""><option value="" disabled>Select make</option><option>Perodua</option><option>Proton</option><option>Toyota</option><option>Honda</option><option>Nissan</option></select></label>
            <label><span>02</span><small>MODEL</small><select defaultValue=""><option value="" disabled>Select model</option><option>Myvi</option><option>Bezza</option><option>Saga</option><option>City</option><option>Vios</option></select></label>
            <label><span>03</span><small>YEAR</small><select defaultValue=""><option value="" disabled>Select year</option><option>2026</option><option>2025</option><option>2024</option><option>2023</option></select></label>
            <label><span>04</span><small>VARIANT / ENGINE</small><select defaultValue=""><option value="" disabled>Select variant</option><option>1.3</option><option>1.5</option><option>2.0</option></select></label>
            <button>FIND COMPATIBLE PARTS <span>→</span></button>
          </div>
          <div className="garageLine"><span>+</span><div><strong>MY GARAGE</strong><small>Save your vehicle once. Shop compatible parts every time.</small></div><Link href="/garage">OPEN GARAGE →</Link></div>
        </div>
      </section>

      <section className="categorySection">
        <div className="container">
          <div className="sectionKicker">02 / CATEGORIES</div>
          <div className="sectionHead compact"><h2>BUILT AROUND<br/>THE MACHINE.</h2><Link href="/products">VIEW ALL PARTS ↗</Link></div>
          <div className="premiumCategories">
            {categories.map(([name,desc,num]) => <Link href="/products" className="premiumCategory" key={name}><span className="categoryNo">{num}</span><div><h3>{name}</h3><p>{desc}</p></div><b>↗</b></Link>)}
          </div>
        </div>
      </section>

      <section className="trustSection">
        <div className="container trustGrid">
          <div><div className="sectionKicker light">03 / MIVO STANDARD</div><h2>CONFIDENCE,<br/>BUILT IN.</h2></div>
          <div className="trustPoints">
            <article><span>01</span><h3>Verified Fitment</h3><p>Compatibility data structured around vehicle make, model, generation, year and engine.</p></article>
            <article><span>02</span><h3>Trusted Products</h3><p>Clear brand, specification and product information before you buy.</p></article>
            <article><span>03</span><h3>Premium Experience</h3><p>A focused automotive catalogue without marketplace clutter.</p></article>
          </div>
        </div>
      </section>

      <section className="brandSection">
        <div className="container">
          <div className="sectionKicker">04 / SELECTED BRANDS</div>
          <div className="brandRail">{brands.map(brand => <span key={brand}>{brand}</span>)}</div>
          <div className="closingStatement"><p>THE RIGHT PART<br/>STARTS WITH<br/><strong>THE RIGHT DATA.</strong></p><a href="#vehicle">SELECT YOUR VEHICLE ↗</a></div>
        </div>
      </section>
    </main>
  );
}