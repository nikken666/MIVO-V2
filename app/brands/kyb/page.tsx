import Link from "next/link";

export default function BrandPage() {
  return (
    <main className="brandProfilePage">
      <section className="brandProfileHero">
        <Link href="/products?view=brands" className="brandProfileBack">BRANDS</Link>
        <img src="/brands/kyb-logo.svg" alt="KYB logo" />
        <h1>KYB</h1>
        <p>A globally recognized name in suspension technology, known for shock absorbers and ride-control components.</p>
      </section>
      <section className="brandProfileInfo">
        <div><span>AVAILABLE ON MIVO</span><h2>Product range</h2><p>Shock absorbers, suspension and related ride-control components.</p></div>
        <Link href={"/products?q=KYB"} className="brandProfileAction">EXPLORE KYB PRODUCTS</Link>
      </section>
    </main>
  );
}
