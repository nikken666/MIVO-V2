"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMarketplace } from "./MarketplaceProvider";
import Logo from "./Logo";

export default function Header() {
  const { cartCount } = useMarketplace();
  const [loggedIn, setLoggedIn] = useState(false);
  const [customerName, setCustomerName] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function syncUser(user: {
      id: string;
      email?: string | null;
      user_metadata?: Record<string, unknown>;
    } | null) {
      if (!active) return;

      if (!user) {
        setLoggedIn(false);
        setCustomerName("");
        return;
      }

      setLoggedIn(true);

      let profileName = "";
      try {
        const { data } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (typeof data?.full_name === "string") {
          profileName = data.full_name.trim();
        }
      } catch {}

      const metadataName =
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name.trim()
          : "";

      const emailName = user.email?.split("@")[0] || "Customer";
      setCustomerName(profileName || metadataName || emailName);
    }

    supabase.auth
      .getUser()
      .then(({ data }) => syncUser(data.user))
      .catch(() => {});

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncUser(session?.user || null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      <div className="announcementBar">
        <div className="container">
          <span>MIVO · PREMIUM AUTOMOTIVE PARTS</span>
          <span>Malaysia-wide delivery · Secure checkout</span>
        </div>
      </div>

      <header className="siteHeader">
        <div className="container headerMain">
          <Link href="/" className="brand" aria-label="MIVO Home">
            <Logo variant="dark" className="headerLogo" />
          </Link>

          <form className="headerSearch" action="/products">
            <span className="searchGlyph">⌕</span>
            <input name="q" placeholder="Search part, OEM number, SKU or brand" />
            <button type="submit">SEARCH</button>
          </form>

          <div className="headerActions">
            <Link href="/garage" className="headerAction">
              <small>VEHICLE</small>
              <strong>My Garage</strong>
            </Link>

            <Link
              href={loggedIn ? "/account" : "/login"}
              className={
                loggedIn
                  ? "headerAction accountHeaderAction"
                  : "headerAction accountHeaderAction signInHeaderAction"
              }
            >
              <small>ACCOUNT</small>
              <strong>
                {loggedIn ? "Hello, " + (customerName || "Customer") : "SIGN IN →"}
              </strong>
            </Link>

            <Link href="/cart" className="cartAction">
              <span>Cart</span>
              <b>{cartCount}</b>
            </Link>
          </div>
        </div>

        <div className="navRow">
          <div className="container navInner">
            <nav className="mainNav" aria-label="Main navigation">
              <Link href="/products">ALL PARTS</Link>
              <Link href="/products">MAINTENANCE</Link>
              <Link href="/products">BRAKING</Link>
              <Link href="/products">SUSPENSION</Link>
              <Link href="/products">STEERING</Link>
              <Link href="/products">DRIVETRAIN</Link>
              <Link href="/products">COOLING</Link>
              <Link href="/brands">BRANDS</Link>
            </nav>
            <Link href="/track-order" className="trackLink">
              TRACK ORDER ↗
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
