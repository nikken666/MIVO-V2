"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMarketplace } from "./MarketplaceProvider";

export default function Header() {
  const { cartCount } = useMarketplace();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function loadUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (active) {
          setLoggedIn(Boolean(user));
        }
      } catch {
        if (active) {
          setLoggedIn(false);
        }
      }
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setLoggedIn(Boolean(session?.user));
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="siteHeader">
      <div className="container topbar">
        <Link href="/" className="brand" aria-label="MIVO Home">
          <img
            className="brandImage"
            src="/mivo-logo.png"
            alt="MIVO"
          />
        </Link>

        <nav className="mainNav" aria-label="Main navigation">
          <Link href="/products">Categories</Link>
          <Link href="/brands">Brands</Link>
          <Link href="/#deals">Deals</Link>
          <Link href="/services">Services</Link>
          <Link href="/garage">Garage⌄</Link>
          <Link href="/sellers">Sell on MIVO</Link>
        </nav>

        <div className="headerTools">
          <Link href="/track-order">◉ Track Order</Link>
          <Link href="/help">? Help</Link>

          <Link href="/cart">
            🛒 Cart <span className="cartBadge">{cartCount}</span>
          </Link>

          <Link
            href={loggedIn ? "/account" : "/login"}
            className="loginButton"
          >
            {loggedIn ? "My Account" : "Login / Sign Up"}
          </Link>
        </div>
      </div>
    </header>
  );
}