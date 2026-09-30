import Link from "next/link";

export default function BrandPage() {
  return (
    <main className="brandProfilePage">
      <section className="brandProfileHero">
        <Link href="/products?view=brands" className="brandProfileBack">BRANDS</Link>
        <img src="/brands/gsp-logo.svg" alt="GSP logo" />
        <h1>GSP</h1>
        <p>A specialist automotive parts brand with a strong focus on drivetrain and chassis replacement components.</p>
      </section>
      <section className="brandProfileInfo">
        <div><span>AVAILABLE ON MIVO</span><h2>Product range</h2><p>Drive shafts, CV joints and selected drivetrain components.</p></div>
        <Link href={"/products?q=GSP"} className="brandProfileAction">EXPLORE GSP PRODUCTS</Link>
      </section>
    </main>
  );
}
