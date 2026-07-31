import Link from "next/link";

export default function Header() {
  return (
    <header className="siteHeader">
      <div className="container topbar">
        <Link href="/" className="brand" aria-label="MIVO Home">
          <img
            className="brandImage"
            src="/mivo-logo.png"
            alt="MIVO"
          />
          <span className="brandFallback">MIVO</span>
        </Link>

        <nav className="mainNav" aria-label="Main navigation">
          <Link href="/#categories">Categories</Link>
          <Link href="/#brands">Brands</Link>
          <Link href="/#deals">Deals</Link>
          <Link href="/#services">Services</Link>
          <Link href="/#garage">Garage⌄</Link>
        </nav>

        <div className="headerTools">
          <Link href="/#track">◉ Track Order</Link>
          <Link href="/#help">? Help</Link>
          <Link href="/cart">🛒 Cart <span className="cartBadge">0</span></Link>
          <Link href="/#login" className="loginButton">Login / Sign Up</Link>
        </div>
      </div>
    </header>
  );
}
