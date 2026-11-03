"use client";

import Link from "next/link";
import Logo from "./Logo";
import { useT } from "./LanguageProvider";

export default function Footer() {
  const t = useT();
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
          <Link href="/#fitment">{t("footer.vehicleMatch")}</Link>
          <Link href="/#standard">{t("footer.standard")}</Link>
          <Link href="/sell">{t("footer.sell")}</Link>
        </div>
      </div>
      <div className="container footerBottom">
        <span>{t("footer.rights", { year: new Date().getFullYear() })}</span>
        <span>{t("footer.bottom")}</span>
      </div>
    </footer>
  );
}
