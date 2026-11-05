"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Logo from "./Logo";
import { useT } from "./LanguageProvider";

export default function Footer() {
  const t = useT();
  // "Sell on MIVO" shows only when the superadmin turns seller sign-up on.
  const [showSell, setShowSell] = useState(false);
  useEffect(() => {
    void createClient()
      .from("platform_settings")
      .select("value")
      .eq("key", "show_sell_link")
      .maybeSingle()
      .then(({ data }) => setShowSell(data?.value === true));
  }, []);
  return (
    <footer className="siteFooter">
      <div className="container footerTop">
        <div className="footerBrandBlock">
          <Logo variant="dark" className="footerLogoAsset" />
          <p>{t("footer.tagline")}</p>
        </div>
        <div>
          <h4>{t("footer.shop")}</h4>
          <Link href="/products">{t("footer.allParts")}</Link>
          <Link href="/products?view=brands">{t("footer.brands")}</Link>
          <Link href="/garage">{t("footer.garage")}</Link>
        </div>
        <div>
          <h4>{t("footer.support")}</h4>
          <Link href="/orders">{t("footer.track")}</Link>
          <Link href="/account">{t("footer.account")}</Link>
          <Link href="/shipping-policy">{t("footer.shipping")}</Link>
          <Link href="/returns-policy">{t("footer.returns")}</Link>
          <Link href="/privacy-policy">{t("footer.privacy")}</Link>
        </div>
        <div>
          <h4>{t("footer.about")}</h4>
          <Link href="/?addVehicle=1">{t("footer.vehicleMatch")}</Link>
          <Link href="/#standard">{t("footer.standard")}</Link>
          {showSell ? <Link href="/sell">{t("footer.sell")}</Link> : null}
        </div>
      </div>
      <div className="container footerBottom">
        <span>{t("footer.rights", { year: new Date().getFullYear() })}</span>
        <span>{t("footer.bottom")}</span>
      </div>
    </footer>
  );
}
