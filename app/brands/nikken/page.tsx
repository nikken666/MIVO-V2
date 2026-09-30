import Link from "next/link";

export default function BrandPage() {
  return (
    <main className="brandProfilePage">
      <section className="brandProfileHero">
        <Link href="/products?view=brands" className="brandProfileBack">BRANDS</Link>
        <img src="/brands/nikken-logo.svg" alt="NIKKEN logo" />
        <h1>NIKKEN</h1>
        <p>Japanese automotive replacement parts focused on dependable everyday performance, fitment and durability.</p>
      </section>
      <section className="brandProfileInfo">
        <div><span>AVAILABLE ON MIVO</span><h2>Product range</h2><p>Cooling, steering, drivetrain, braking and selected maintenance parts.</p></div>
        <Link href={"/products?q=NIKKEN"} className="brandProfileAction">EXPLORE NIKKEN PRODUCTS</Link>
      </section>
    </main>
  );
}
