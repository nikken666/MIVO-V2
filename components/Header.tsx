"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMarketplace } from "./MarketplaceProvider";
import Logo from "./Logo";
import VehiclePickerButton, { openVehiclePicker } from "./VehiclePickerButton";
import { useLanguage } from "./LanguageProvider";
import SearchSuggest from "./SearchSuggest";
import { localeNames, locales, type Locale } from "@/lib/i18n";

export default function Header() {
  const { cartCount } = useMarketplace();
  const { t, locale, setLocale } = useLanguage();
  const [loggedIn, setLoggedIn] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);


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
          <span>{t("header.announce")}</span>
          <span className="announcementTools">
            <span className="announceSecure">{t("header.secure")}</span>
            <label className="languageSwitch">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
              </svg>
              <span className="srOnly">{t("header.language")}</span>
              <select
                value={locale}
                onChange={(event) => setLocale(event.target.value as Locale)}
                aria-label={t("header.language")}
              >
                {locales.map((code) => (
                  <option key={code} value={code}>
                    {localeNames[code]}
                  </option>
                ))}
              </select>
            </label>
          </span>
        </div>
      </div>

      <header className="siteHeader">
        <div className="container headerMain">
          <Link href="/" className="brand" aria-label="MIVO Home">
            <Logo variant="dark" className="headerLogo" />
          </Link>

          <form className="headerSearch hasVehicleChip" action="/products">
            <VehiclePickerButton variant="chip" autoOpenFromUrl />
            <SearchSuggest inputRef={searchRef} />
            <button type="submit">{t("header.search")}</button>
          </form>

          <div className="headerActions">
            <Link href="/garage" className="headerAction">
              <small>{t("header.garageSmall")}</small>
              <strong>{t("header.garage")}</strong>
            </Link>

            <Link
              href={loggedIn ? "/account" : "/login"}
              className={
                loggedIn
                  ? "headerAction accountHeaderAction"
                  : "headerAction accountHeaderAction signInHeaderAction"
              }
            >
              <small>{t("header.account")}</small>
              <strong>
                {loggedIn
                  ? t("header.hello", { name: customerName || "" })
                  : t("header.signIn")}
              </strong>
            </Link>

            <Link href="/cart" className="cartAction">
              <span>{t("header.cart")}</span>
              <b>{cartCount}</b>
            </Link>
          </div>
        </div>

        <div className="navRow">
          <div className="container navInner">
            <nav className="mainNav" aria-label="Main navigation">
              <Link href="/products">{t("nav.all")}</Link>
              <Link href="/products?group=maintenance">{t("nav.maintenance")}</Link>
              <Link href="/products?group=braking">{t("nav.braking")}</Link>
              <Link href="/products?group=suspension">{t("nav.suspension")}</Link>
              <Link href="/products?group=steering">{t("nav.steering")}</Link>
              <Link href="/products?group=drivetrain">{t("nav.drivetrain")}</Link>
              <Link href="/products?group=cooling">{t("nav.cooling")}</Link>
              <Link href="/products?view=brands">{t("nav.brands")}</Link>
              <Link href="/shops">{t("nav.shops")}</Link>
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
                {t("header.addCar")}
              </Link>
              <Link href="/orders" className="trackLink">
                {t("header.track")}
              </Link>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
