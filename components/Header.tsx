"use client";

import Link from "next/link";
import { useMarketplace } from "./MarketplaceProvider";

export default function Header() {
  const { cartCount } = useMarketplace();

  return (
    <header className="siteHeader">
      <div className="container topbar">
        <Link href="/" className="brand" aria-label="MIVO Home">
          <img className="brandImage" src="/mivo-logo.png" alt="MIVO" />
        </Link>

        <nav className="mainNav" aria-label="Main navigation">
          <Link href="/products">Categories</Link>
          <Link href="/brands">Brands</Link>
          <Link href="/#deals">Deals</Link>
          <Link href="/services">Services</Link>
          <Link href="/garage">Garage⌄</Link>
        </nav>

        <div className="headerTools">
          <Link href="/track-order">◉ Track Order</Link>
          <Link href="/help">? Help</Link>
          <Link href="/cart">
            🛒 Cart <span className="cartBadge">{cartCount}</span>
          </Link>
          <Link href="/login" className="loginButton">Login / Sign Up</Link>
        </div>
      </div>
    </header>
  );
}
