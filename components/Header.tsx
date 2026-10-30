"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMarketplace } from "./MarketplaceProvider";
import Logo from "./Logo";
import VehiclePickerButton, { openVehiclePicker } from "./VehiclePickerButton";

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
          <span>Parts matched to your car, delivered Malaysia-wide.</span>
          <span>Secure checkout</span>
        </div>
      </div>

      <header className="siteHeader">
        <div className="container headerMain">
          <Link href="/" className="brand" aria-label="MIVO Home">
            <Logo variant="dark" className="headerLogo" />
          </Link>

          <form className="headerSearch hasVehicleChip" action="/products">
            <VehiclePickerButton variant="chip" autoOpenFromUrl />
            <input name="q" placeholder="Search parts, OEM number or brand" />
            <button type="submit">Search</button>
          </form>

          <div className="headerActions">
            <Link href="/garage" className="headerAction">
              <small>Vehicle</small>
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
              <small>Account</small>
              <strong>
                {loggedIn ? "Hello, " + (customerName || "Customer") : "Sign in"}
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
              <Link href="/products">All Parts</Link>
              <Link href="/products?group=maintenance">Maintenance</Link>
              <Link href="/products?group=braking">Braking</Link>
              <Link href="/products?group=suspension">Suspension</Link>
              <Link href="/products?group=steering">Steering</Link>
              <Link href="/products?group=drivetrain">Drivetrain</Link>
              <Link href="/products?group=cooling">Cooling</Link>
              <Link href="/products?view=brands">Brands</Link>
            </nav>
            <div className="navUtilityLinks">
              <Link
                href="/?addVehicle=1"
                className="addCarLink"
                onClick={(event) => {
                  event.preventDefault();
                  openVehiclePicker();
                }}
              >
                + Add car
              </Link>
              <Link href="/orders" className="trackLink">
                Track order
              </Link>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
