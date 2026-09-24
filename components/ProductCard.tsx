"use client";

import Link from "next/link";
import type { Product } from "@/data/products";
import { formatPrice } from "@/data/products";
import type { FitmentStatus } from "@/data/fitments";
import { useMarketplace } from "./MarketplaceProvider";

const brandLogos: Record<string, string> = {
  NIKKEN: "/brands/nikken-logo.svg",
  KYB: "/brands/kyb-logo.svg",
  GSP: "/brands/gsp-logo.svg",
};

const fitmentCopy: Record<FitmentStatus, { pill: string; text: string }> = {
  fits: {
    pill: "✓ FITS YOUR VEHICLE",
    text: "Confirmed compatible with your selected vehicle",
  },
  universal: {
    pill: "UNIVERSAL",
    text: "Not restricted to one specific vehicle fitment",
  },
  "not-fit": {
    pill: "NOT COMPATIBLE",
    text: "This product does not match your selected vehicle",
  },
  unverified: {
    pill: "FITMENT NOT VERIFIED",
    text: "Compatibility data has not been confirmed yet",
  },
};

export default function ProductCard({
  product,
  compact = false,
  fitmentStatus,
  hrefSuffix = "",
}: {
  product: Product;
  compact?: boolean;
  fitmentStatus?: FitmentStatus;
  hrefSuffix?: string;
}) {
  const { addToCart } = useMarketplace();
  const activeVariants = (product.variants || []).filter((variant) => variant.isActive);
  const requiresSelection =
    Boolean(product.variation1Name) ||
    Boolean(product.variation2Name) ||
    activeVariants.length > 1;
  const singleVariant = activeVariants.length === 1 ? activeVariants[0] : undefined;
  const soldOut =
    activeVariants.length > 0
      ? activeVariants.every((variant) => variant.stock <= 0)
      : product.stock === 0;

  const detailHref = "/products/" + product.slug + hrefSuffix;
  const fitment = fitmentStatus ? fitmentCopy[fitmentStatus] : null;
  const cardClass =
    (compact ? "productCard premiumProductCard" : "catalogCard premiumProductCard") +
    (fitmentStatus ? " fitmentState-" + fitmentStatus : "");
  const imageClass = compact
    ? "productPicture premiumProductImage"
    : "catalogImage premiumProductImage";
  const pillClass = "fitmentPill" + (fitmentStatus ? " " + fitmentStatus : "");
  const fitmentTextClass =
    "productFitmentText" + (fitmentStatus ? " " + fitmentStatus : "");

  return (
    <article className={cardClass}>
      <Link href={detailHref} className={imageClass}>
        <span className="productCategoryLabel">{product.category}</span>
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} />
        ) : (
          <div className="productPlaceholder" aria-hidden="true">
            <span>{product.icon}</span>
            <i />
          </div>
        )}

        <span className={pillClass}>
          {fitment?.pill || "FITMENT CHECK"}
        </span>
      </Link>

      <div className="productMeta">
        <div className="productBrandRow">
          <span className="productBrandIdentity">
            {brandLogos[product.brand] ? (
              <img className="productBrandLogo" src={brandLogos[product.brand]} alt={product.brand} />
            ) : (
              product.brand
            )}
          </span>
          <span>★ {Math.min(5, 4.6 + (product.reviews % 4) / 10).toFixed(1)}</span>
        </div>

        <Link href={detailHref}>
          <h3>{product.name}</h3>
        </Link>

        <p className={fitmentTextClass}>
          {fitment?.text || "Check compatibility with your vehicle"}
        </p>

        <div className="productBottom">
          <strong>
            {requiresSelection ? "From " : ""}
            {formatPrice(product.price)}
          </strong>

          {requiresSelection ? (
            <Link href={detailHref} className="miniCartButton">
              OPTIONS
            </Link>
          ) : (
            <button
              className="miniCartButton"
              type="button"
              disabled={soldOut || fitmentStatus === "not-fit"}
              onClick={() => addToCart(product, singleVariant)}
            >
              {fitmentStatus === "not-fit" ? "NO FIT" : soldOut ? "SOLD OUT" : "ADD"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
