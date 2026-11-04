"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { flyToCart } from "@/lib/flyToCart";
import type { Product } from "@/data/products";
import { formatPrice } from "@/data/products";
import type { FitmentStatus } from "@/data/fitments";
import { useMarketplace } from "./MarketplaceProvider";
import { ShopLine } from "./ShopBadge";
import { useT } from "./LanguageProvider";
import type { Translate } from "@/lib/i18n";

const brandLogos: Record<string, string> = {
  NIKKEN: "/brands/nikken-logo.svg",
  KYB: "/brands/kyb-logo.svg",
  GSP: "/brands/gsp-logo.svg",
};

function fitmentCopy(t: Translate): Record<FitmentStatus, { pill: string; text: string }> {
  return {
    fits: {
      pill: t("fit.fits"),
      text: t("browse.card.fitsText"),
    },
    universal: {
      pill: t("fit.fits"),
      text: t("browse.card.universalText"),
    },
    "not-fit": {
      pill: t("fit.notFit"),
      text: t("browse.card.notFitText"),
    },
    unverified: {
      pill: t("fit.unverified"),
      text: t("browse.card.unverifiedText"),
    },
    "seller-fits": {
      pill: t("fit.sellerSays"),
      text: t("fit.sellerSaysText"),
    },
    likely: {
      pill: t("fit.likely"),
      text: t("fit.likelyText"),
    },
  };
}

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
  const t = useT();
  const { addToCart } = useMarketplace();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const cardRef = useRef<HTMLElement>(null);
  const flyFromCard = () => flyToCart(cardRef.current?.querySelector(".premiumProductImage img") || cardRef.current?.querySelector(".premiumProductImage"));

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
  // Only good news (or a confirmed mismatch) is shown: unknown fitment stays quiet.
  const shownStatus = fitmentStatus === "unverified" ? undefined : fitmentStatus;
  const fitment = shownStatus ? fitmentCopy(t)[shownStatus] : null;
  const visualFitmentStatus =
    shownStatus === "universal" || shownStatus === "seller-fits" ? "fits" : shownStatus;
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
    flyFromCard();
    setQuickAddOpen(false);
    setQuantity(1);
  }

  return (
    <article className={cardClass} ref={cardRef}>
      <div className="productImageWrap">
      <Link href={detailHref} className={imageClass}>
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} onError={(event) => {
            const image = event.currentTarget;
            image.onerror = null;
            image.src = product.brand === "GSP" ? "/brands/gsp-logo.svg" : "/mivo-logo-dark.svg";
            image.title = t("browse.card.photoUnavailable");
          }} />
        ) : null}
        {/* A6: desktop hover shows the second photo */}
        {product.imageUrl && product.imageUrls?.[1] && product.imageUrls[1] !== product.imageUrl ? (
          <img
            className="productAltImage"
            src={product.imageUrls[1]}
            alt=""
            aria-hidden="true"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        {product.imageUrl ? null : (
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
          {t("browse.card.viewDetails")}
        </Link>
        {!requiresSelection && fitmentStatus !== "not-fit" && !soldOut ? (
          <button
            type="button"
            className="productHoverAdd"
            onClick={() => {
              addToCart(product, singleVariant, 1);
              flyFromCard();
            }}
          >
            {t("browse.card.addToCart")}
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
            <span>{t("browse.card.new")}</span>
          )}
        </div>

        <Link href={detailHref}>
          <h3>{product.name}</h3>
        </Link>

        <ShopLine
          name={product.seller}
          tier={product.sellerTier}
          sellerSlug={product.sellerSlug}
          sellerId={product.sellerId}
        />

        {!fitmentStatus && product.fitmentLevel && product.fitmentLevel !== "none" ? (
          <span className={"fitmentLevelTag level-" + product.fitmentLevel}>
            {product.fitmentLevel === "verified" ? t("fit.levelVerified") : t("fit.levelSeller")}
          </span>
        ) : null}

        <p className={fitmentTextClass}>
          {fitment?.text || t("browse.card.defaultText")}
        </p>

        <div className="productBottom">
          <div className="productCardPriceStack">
            {cardComparePrice ? (
              <del>{formatPrice(cardComparePrice)}</del>
            ) : null}
            <strong>
              {requiresSelection
                ? t("browse.card.fromPrice", { price: formatPrice(product.price) })
                : formatPrice(product.price)}
            </strong>
          </div>

          {requiresSelection || fitmentStatus === "not-fit" ? (
            <Link href={detailHref} className="miniCartButton">
              {fitmentStatus === "not-fit" ? t("card.view") : t("card.options")}
            </Link>
          ) : (
            <button
              className="miniCartButton"
              type="button"
              disabled={soldOut}
              onClick={() => setQuickAddOpen((open) => !open)}
            >
              {soldOut
                ? t("card.soldOut")
                : quickAddOpen
                  ? t("browse.card.cancel")
                  : t("card.add")}
            </button>
          )}
        </div>

        {quickAddOpen && !requiresSelection && !soldOut ? (
          <div className="quickAddPanel">
            <div>
              <span>{t("browse.card.quantity")}</span>
              <div className="quantityStepper">
                <button
                  type="button"
                  onClick={decrease}
                  disabled={quantity <= 1}
                  aria-label={t("browse.card.decrease")}
                >
                  −
                </button>
                <strong>{quantity}</strong>
                <button
                  type="button"
                  onClick={increase}
                  disabled={quantity >= maxQuantity}
                  aria-label={t("browse.card.increase")}
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
              {t("browse.card.addN", { n: quantity })}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
