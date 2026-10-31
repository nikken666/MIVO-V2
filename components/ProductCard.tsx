"use client";

import Link from "next/link";
import { useState } from "react";
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
    pill: "✓ Fits your car",
    text: "Confirmed compatible with your selected vehicle",
  },
  universal: {
    pill: "✓ Fits your car",
    text: "Compatible with your selected vehicle",
  },
  "not-fit": {
    pill: "Doesn't fit",
    text: "This product does not match your selected vehicle",
  },
  unverified: {
    pill: "Fitment unverified",
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
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const activeVariants = (product.variants || []).filter(
    (variant) => variant.isActive
  );
  const requiresSelection =
    Boolean(product.variation1Name) ||
    Boolean(product.variation2Name) ||
    activeVariants.length > 1;
  const singleVariant =
    activeVariants.length === 1 ? activeVariants[0] : undefined;
  const soldOut =
    activeVariants.length > 0
      ? activeVariants.every((variant) => variant.stock <= 0)
      : product.stock === 0;

  const cheapestVariant =
    activeVariants.length > 0
      ? activeVariants.reduce((best, variant) =>
          variant.price < best.price ? variant : best
        )
      : undefined;
  const cardComparePrice =
    cheapestVariant?.compareAtPrice &&
    cheapestVariant.compareAtPrice > cheapestVariant.price
      ? cheapestVariant.compareAtPrice
      : null;
  const cardDiscountPercent =
    cheapestVariant?.discountPercent ||
    (cardComparePrice && cheapestVariant
      ? Math.round(
          ((cardComparePrice - cheapestVariant.price) /
            cardComparePrice) *
            100
        )
      : null);

  const maxQuantity =
    typeof singleVariant?.stock === "number"
      ? singleVariant.stock
      : typeof product.stock === "number"
        ? product.stock
        : 99;

  const detailHref = "/products/" + product.slug + hrefSuffix;
  const fitment = fitmentStatus ? fitmentCopy[fitmentStatus] : null;
  const visualFitmentStatus =
    fitmentStatus === "universal" ? "fits" : fitmentStatus;
  const cardClass =
    (compact
      ? "productCard premiumProductCard"
      : "catalogCard premiumProductCard") +
    (visualFitmentStatus ? " fitmentState-" + visualFitmentStatus : "");
  const imageClass = compact
    ? "productPicture premiumProductImage"
    : "catalogImage premiumProductImage";
  const pillClass =
    "fitmentPill" +
    (visualFitmentStatus ? " " + visualFitmentStatus : "");
  const fitmentTextClass =
    "productFitmentText" +
    (visualFitmentStatus ? " " + visualFitmentStatus : "");

  function decrease() {
    setQuantity((current) => Math.max(1, current - 1));
  }

  function increase() {
    setQuantity((current) =>
      Math.min(Math.max(1, maxQuantity), current + 1)
    );
  }

  function confirmAdd() {
    addToCart(product, singleVariant, quantity);
    setQuickAddOpen(false);
    setQuantity(1);
  }

  return (
    <article className={cardClass}>
      <div className="productImageWrap">
      <Link href={detailHref} className={imageClass}>
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} onError={(event) => {
            const image = event.currentTarget;
            image.onerror = null;
            image.src = product.brand === "GSP" ? "/brands/gsp-logo.svg" : "/mivo-logo-dark.svg";
            image.title = "Product photo unavailable";
          }} />
        ) : (
          <div className="productPlaceholder" aria-hidden="true">
            <span>{product.icon}</span>
            <i />
          </div>
        )}

        {fitment ? <span className={pillClass}>{fitment.pill}</span> : null}

        {cardDiscountPercent ? (
          <span className="productDiscountBadge">
            -{Math.round(cardDiscountPercent)}%
          </span>
        ) : null}
      </Link>

      {/* Hover actions (desktop): quick paths without opening the card first. */}
      <div className="productHoverActions">
        <Link href={detailHref} className="productHoverView">
          View details
        </Link>
        {!requiresSelection && fitmentStatus !== "not-fit" && !soldOut ? (
          <button
            type="button"
            className="productHoverAdd"
            onClick={() => addToCart(product, singleVariant, 1)}
          >
            Add to cart
          </button>
        ) : null}
      </div>
      </div>

      <div className="productMeta">
        <div className="productBrandRow">
          <span className="productBrandIdentity">
            {brandLogos[product.brand] ? (
              <img
                className="productBrandLogo"
                src={brandLogos[product.brand]}
                alt={product.brand}
              />
            ) : (
              product.brand
            )}
          </span>
          {Number(product.rating || 0) > 0 ? (
            <span>★ {Number(product.rating).toFixed(1)}</span>
          ) : (
            <span>New</span>
          )}
        </div>

        <Link href={detailHref}>
          <h3>{product.name}</h3>
        </Link>

        <p className={fitmentTextClass}>
          {fitment?.text || "Check compatibility with your vehicle"}
        </p>

        <div className="productBottom">
          <div className="productCardPriceStack">
            {cardComparePrice ? (
              <del>{formatPrice(cardComparePrice)}</del>
            ) : null}
            <strong>
              {requiresSelection ? "From " : ""}
              {formatPrice(product.price)}
            </strong>
          </div>

          {requiresSelection || fitmentStatus === "not-fit" ? (
            <Link href={detailHref} className="miniCartButton">
              {fitmentStatus === "not-fit" ? "View" : "Options"}
            </Link>
          ) : (
            <button
              className="miniCartButton"
              type="button"
              disabled={soldOut}
              onClick={() => setQuickAddOpen((open) => !open)}
            >
              {soldOut
                ? "Sold out"
                : quickAddOpen
                  ? "Cancel"
                  : "Add"}
            </button>
          )}
        </div>

        {quickAddOpen && !requiresSelection && !soldOut ? (
          <div className="quickAddPanel">
            <div>
              <span>Quantity</span>
              <div className="quantityStepper">
                <button
                  type="button"
                  onClick={decrease}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <strong>{quantity}</strong>
                <button
                  type="button"
                  onClick={increase}
                  disabled={quantity >= maxQuantity}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              className="quickAddConfirm"
              onClick={confirmAdd}
            >
              Add {quantity} to cart
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
