"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type {
  Product,
  ProductPublicReview,
  ProductVariant,
} from "@/data/products";
import type { FitmentStatus } from "@/data/fitments";
import CarRecommendations from "@/components/CarRecommendations";
import ShopVouchers from "@/components/ShopVouchers";
import { useLanguage } from "./LanguageProvider";
import { intlTag } from "@/lib/i18n/format";
import type { Translate } from "@/lib/i18n";
import { openChat } from "./chat/ChatWidget";
import { formatPrice } from "@/data/products";
import { useMarketplace } from "./MarketplaceProvider";
import ProductCard from "./ProductCard";
import ProductVehicleSelector from "./ProductVehicleSelector";
import { htmlToParagraphs, htmlToPlainText } from "@/lib/plainText";
import ShopBadge, { shopHref } from "./ShopBadge";
import { flyToCart } from "@/lib/flyToCart";

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  );
}

function stockCopy(t: Translate, stock: number | undefined) {
  if (typeof stock !== "number") return t("buy.pd.selectVariation");
  if (stock <= 0) return t("buy.pd.outOfStock");
  if (stock <= 20) return t("buy.pd.onlyLeft", { n: stock });
  return t("buy.pd.inStock");
}

export default function ProductDetailClient({
  product,
  productReviews = [],
  relatedProducts = [],
  fitmentStatus,
  variantFitmentStatuses = {},
  selectedVehicleLabel,
}: {
  product: Product;
  productReviews?: ProductPublicReview[];
  relatedProducts?: Product[];
  fitmentStatus?: FitmentStatus;
  variantFitmentStatuses?: Record<string, FitmentStatus>;
  selectedVehicleLabel?: string;
}) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const { addToCart, startBuyNow, cartReady } = useMarketplace();

  const images = useMemo(
    () =>
      Array.from(
        new Set(
          [
            product.imageUrl,
            ...(product.imageUrls || []),
            ...((product.variants || []).map((variant) => variant.imageUrl)),
          ].filter((url): url is string => Boolean(url))
        )
      ),
    [product.imageUrl, product.imageUrls, product.variants]
  );

  const shortDescriptionText = htmlToPlainText(product.shortDescription);
  // The long description usually repeats the short one, so show it on its
  // own and fall back to the short description only when it is missing.
  const descriptionParagraphs = useMemo(
    () => htmlToParagraphs(product.description),
    [product.description]
  );

  const [activeImage, setActiveImage] = useState(0);
  const [reviewFilter, setReviewFilter] = useState<
    "all" | "photos" | 1 | 2 | 3 | 4 | 5
  >("all");

  const activeVariants = useMemo(
    () =>
      (product.variants || []).filter(
        (variant) => variant.isActive
      ),
    [product.variants]
  );

  const confirmedFitmentVariants = useMemo(
    () =>
      activeVariants.filter(
        (variant) =>
          variantFitmentStatuses[variant.id] === "fits"
      ),
    [activeVariants, variantFitmentStatuses]
  );

  const selectableVariants = useMemo(
    () => activeVariants,
    [activeVariants]
  );

  const option1Values = useMemo(
    () =>
      uniqueValues(
        selectableVariants.map(
          (variant) => variant.variation1Value
        )
      ),
    [selectableVariants]
  );

  const option1ImageMap = useMemo(() => {
    const map = new Map<string, string>();

    for (const variant of selectableVariants) {
      if (
        variant.variation1Value &&
        variant.imageUrl &&
        !map.has(variant.variation1Value)
      ) {
        map.set(variant.variation1Value, variant.imageUrl);
      }
    }

    return map;
  }, [selectableVariants]);

  const [option1, setOption1] = useState("");
  const [option2, setOption2] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [vehicleSelectorOpen, setVehicleSelectorOpen] = useState(false);
  const [fitmentConfirmAction, setFitmentConfirmAction] = useState<
    "cart" | "buy" | null
  >(null);

  const option2Values = useMemo(
    () =>
      uniqueValues(
        selectableVariants
          .filter(
            (variant) =>
              !product.variation1Name ||
              !option1 ||
              variant.variation1Value === option1
          )
          .map((variant) => variant.variation2Value)
      ),
    [
      selectableVariants,
      option1,
      product.variation1Name,
    ]
  );

  const selectedVariant = useMemo(() => {
    if (
      !product.variation1Name &&
      !product.variation2Name
    ) {
      return selectableVariants[0];
    }

    return selectableVariants.find(
      (variant) =>
        (!product.variation1Name ||
          variant.variation1Value === option1) &&
        (!product.variation2Name ||
          variant.variation2Value === option2)
    );
  }, [
    selectableVariants,
    option1,
    option2,
    product.variation1Name,
    product.variation2Name,
  ]);

  useEffect(() => {
    if (
      !selectedVehicleLabel ||
      selectableVariants.length !== 1
    ) {
      return;
    }

    const onlyVariant = selectableVariants[0];

    if (product.variation1Name) {
      setOption1(onlyVariant.variation1Value || "");
    }

    if (product.variation2Name) {
      setOption2(onlyVariant.variation2Value || "");
    }

    setQuantity(1);
  }, [
    selectedVehicleLabel,
    selectableVariants,
    product.variation1Name,
    product.variation2Name,
  ]);

  const selectionComplete =
    (!product.variation1Name || Boolean(option1)) &&
    (!product.variation2Name || Boolean(option2));

  const displayPrice = selectedVariant?.price ?? product.price;
  const displayRating = Number(product.rating || 0);
  const roundedRating = Math.round(displayRating);
  const displayComparePrice =
    selectedVariant?.compareAtPrice &&
    selectedVariant.compareAtPrice > displayPrice
      ? selectedVariant.compareAtPrice
      : null;
  const displayDiscountPercent =
    selectedVariant?.discountPercent ||
    (displayComparePrice
      ? Math.round(
          ((displayComparePrice - displayPrice) /
            displayComparePrice) *
            100
        )
      : null);
  const displayStock = selectedVariant?.stock ?? product.stock;
  const displaySku = selectedVariant?.sku ?? product.sku;
  const maxQuantity =
    typeof displayStock === "number" && displayStock > 0 ? displayStock : 1;
  const selectedVariantFitmentStatus =
    selectedVariant
      ? variantFitmentStatuses[selectedVariant.id] ||
        fitmentStatus
      : fitmentStatus;
  const fitmentBlocked =
    selectedVariantFitmentStatus === "not-fit";
  const confirmedFitmentCount =
    confirmedFitmentVariants.length;
  const canBuy =
    selectionComplete &&
    Boolean(selectedVariant) &&
    Number(selectedVariant?.stock || 0) > 0;

  const filteredReviews = productReviews.filter((review) => {
    if (reviewFilter === "all") return true;
    if (reviewFilter === "photos") return review.imageUrls.length > 0;
    return review.rating === reviewFilter;
  });

  const reviewCounts = [5, 4, 3, 2, 1].reduce<Record<number, number>>(
    (counts, rating) => {
      counts[rating] = productReviews.filter(
        (review) => review.rating === rating
      ).length;
      return counts;
    },
    {}
  );

  function selectOption1(value: string) {
    setOption1(value);
    setQuantity(1);

    const optionImage = option1ImageMap.get(value);
    if (optionImage) {
      const galleryIndex = images.indexOf(optionImage);
      if (galleryIndex >= 0) {
        setActiveImage(galleryIndex);
      }
    }

    if (
      option2 &&
      !selectableVariants.some(
        (variant) =>
          variant.variation1Value === value &&
          variant.variation2Value === option2 &&
          variant.stock > 0
      )
    ) {
      setOption2("");
    }
  }

  function option1SoldOut(value: string) {
    return !selectableVariants.some(
      (variant) =>
        variant.variation1Value === value && variant.stock > 0
    );
  }

  function option2SoldOut(value: string) {
    return !selectableVariants.some(
      (variant) =>
        (!product.variation1Name ||
          variant.variation1Value === option1) &&
        variant.variation2Value === value &&
        variant.stock > 0
    );
  }

  function completePurchaseAction(action: "cart" | "buy") {
    if (!selectedVariant || !canBuy || !cartReady) return;

    if (action === "buy") {
      startBuyNow(product, selectedVariant, quantity);
      router.push("/checkout");
      return;
    }

    addToCart(product, selectedVariant, quantity);
    flyToCart(document.querySelector(".productGalleryMain img") || document.querySelector(".productGalleryMain"));
    setQuantity(1);
  }

  function requestPurchaseAction(action: "cart" | "buy") {
    if (!selectedVariant || !canBuy || !cartReady) return;

    if (fitmentBlocked && selectedVehicleLabel) {
      setFitmentConfirmAction(action);
      return;
    }

    completePurchaseAction(action);
  }

  function confirmFitmentOverride() {
    const action = fitmentConfirmAction;
    setFitmentConfirmAction(null);
    if (!action) return;
    completePurchaseAction(action);
  }

  // Purchase buttons stay clickable before a variant is chosen; tapping one
  // guides the shopper to the option picker instead of silently doing nothing.
  const [promptChoice, setPromptChoice] = useState(false);
  const outOfStock = selectionComplete && !canBuy;

  function guideToOptions() {
    setPromptChoice(true);
    document
      .querySelector(".productOptionSection")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setPromptChoice(false), 1800);
  }

  function addCurrentToCart() {
    if (!selectionComplete) return guideToOptions();
    requestPurchaseAction("cart");
  }

  function buyNow() {
    if (!selectionComplete) return guideToOptions();
    requestPurchaseAction("buy");
  }

  function previousImage() {
    if (images.length <= 1) return;
    setActiveImage((current) =>
      current === 0 ? images.length - 1 : current - 1
    );
  }

  function nextImage() {
    if (images.length <= 1) return;
    setActiveImage((current) =>
      current === images.length - 1 ? 0 : current + 1
    );
  }

  return (
    <main className="productDetailPage">
      <div className="container">
        <div className="productBreadcrumb">
          <Link href="/products">{t("buy.pd.allParts")}</Link>
          <span>›</span>
          <Link href={"/products?category=" + encodeURIComponent(product.category)}>
            {product.category.toUpperCase()}
          </Link>
          <span>›</span>
          <strong>{product.name}</strong>
        </div>

        <section className="productDetailCommerce">
          <div className="productGallery">
            <div className="productGalleryMain">
              {images[activeImage] ? (
                <img src={images[activeImage]} alt={product.name} />
              ) : (
                <div className="productGalleryPlaceholder">{product.icon}</div>
              )}

              {images.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="galleryArrow galleryArrowLeft"
                    onClick={previousImage}
                    aria-label={t("buy.pd.prevImage")}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="galleryArrow galleryArrowRight"
                    onClick={nextImage}
                    aria-label={t("buy.pd.nextImage")}
                  >
                    ›
                  </button>
                  <span className="galleryCount">
                    {activeImage + 1}/{images.length}
                  </span>
                </>
              ) : null}
            </div>

            {images.length > 1 ? (
              <div className="productGalleryThumbs">
                {images.map((image, index) => (
                  <button
                    type="button"
                    key={image}
                    className={
                      "productGalleryThumb" +
                      (activeImage === index ? " active" : "")
                    }
                    onClick={() => setActiveImage(index)}
                    aria-label={t("buy.pd.viewImage", { n: index + 1 })}
                  >
                    <img src={image} alt="" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="productPurchasePanel">
            <div className="productTitleBlock">
              <span className="detailBrand">{product.brand}</span>
              <h1>{product.name}</h1>

              <div className="productTitleMeta">
                <span className="productRating">
                  <b>{displayRating.toFixed(1)}</b>{" "}
                  {Array.from({ length: 5 }, (_, index) =>
                    index < roundedRating ? "★" : "☆"
                  ).join("")}
                </span>
                <span>
                  {t("buy.pd.reviewCount", { n: product.reviews })}
                </span>
                {displaySku ? <span>SKU {displaySku}</span> : null}
              </div>

              {product.seller ? (
                <div className="productShopRow">
                  <Link href={shopHref(product)} className="productShopCard">
                    <span className="productShopAvatar" aria-hidden="true">
                      {product.sellerLogo ? (
                        <img src={product.sellerLogo} alt="" />
                      ) : (
                        product.seller.slice(0, 1)
                      )}
                    </span>
                    <span className="productShopText">
                      <strong>
                        {product.seller} <ShopBadge tier={product.sellerTier} />
                      </strong>
                      <small>{t("shop.visit")} ›</small>
                    </span>
                  </Link>
                  {product.sellerId ? (
                    <button
                      type="button"
                      className="chatNowButton"
                      onClick={() =>
                        openChat({ sellerId: product.sellerId, productId: product.id })
                      }
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" />
                      </svg>
                      {t("chat.chatNow")}
                    </button>
                  ) : null}
                </div>
              ) : null}
              <ShopVouchers sellerId={product.sellerId} compact />
            </div>

            <div className="productPricePanel">
              <div>
                {displayComparePrice ? (
                  <del>{formatPrice(displayComparePrice)}</del>
                ) : null}
                <strong>{formatPrice(displayPrice)}</strong>
                {displayDiscountPercent ? (
                  <b className="productDetailDiscountBadge">
                    -{Math.round(displayDiscountPercent)}%
                  </b>
                ) : null}
              </div>
              <span>
                {displayDiscountPercent ? t("buy.pd.salePrice") : t("buy.pd.price")}
              </span>
            </div>

            <div
              className={
                "productFitmentCompact" +
                (selectedVehicleLabel && selectedVariantFitmentStatus && selectedVariantFitmentStatus !== "unverified"
                  ? " fitment-" +
                    (selectedVariantFitmentStatus === "universal" || selectedVariantFitmentStatus === "seller-fits"
                      ? "fits"
                      : selectedVariantFitmentStatus)
                  : "")
              }
            >
              <div>
                <span>{t("buy.pd.vehicleFitment")}</span>
                {/* Only good news or a confirmed mismatch; unknown fitment stays quiet. */}
                <strong>
                  {!selectedVehicleLabel
                    ? t("buy.pd.pickCarPrompt")
                    : selectedVariantFitmentStatus === "fits" || selectedVariantFitmentStatus === "universal"
                      ? t("buy.pd.fitsYourVehicle")
                      : selectedVariantFitmentStatus === "seller-fits"
                        ? t("fit.sellerSays")
                        : selectedVariantFitmentStatus === "not-fit"
                          ? t("buy.pd.notCompatible")
                          : selectedVehicleLabel}
                </strong>
                {selectedVehicleLabel ? (
                  <>
                    {selectedVariantFitmentStatus && selectedVariantFitmentStatus !== "unverified" ? (
                      <small>{selectedVehicleLabel}</small>
                    ) : null}
                    {selectedVariantFitmentStatus === "not-fit" && confirmedFitmentCount > 0 ? (
                      <small>
                        {t("buy.pd.compatibleOptions", { n: confirmedFitmentCount })}
                      </small>
                    ) : null}
                  </>
                ) : (
                  <small>{t("buy.pd.pickCarHint")}</small>
                )}
              </div>
              <button
                type="button"
                className="productFitmentSelectButton"
                onClick={() => setVehicleSelectorOpen(true)}
              >
                {selectedVehicleLabel ? t("buy.pd.changeVehicle") : t("buy.pd.selectVehicle")}
              </button>
            </div>

            {product.variation1Name ? (
              <section className={"productOptionSection" + (promptChoice && !selectionComplete ? " needsChoice" : "")}>
                <div className="productOptionLabel">
                  <span>{product.variation1Name}</span>
                  <small>
                    {option1 || t("buy.pd.chooseOption")}
                  </small>
                </div>

                <div className="productOptionGrid">
                  {option1Values.map((value) => {
                    const soldOut = option1SoldOut(value);
                    const selected = option1 === value;

                    return (
                      <button
                        type="button"
                        key={value}
                        disabled={soldOut}
                        onClick={() => selectOption1(value)}
                        className={
                          "productOptionButton" +
                          (selected ? " selected" : "")
                        }
                      >
                        {option1ImageMap.get(value) ? (
                          <img
                            className="productOptionImage"
                            src={option1ImageMap.get(value)}
                            alt=""
                          />
                        ) : null}
                        <span>{value}</span>
                        {soldOut ? <small>{t("card.soldOut")}</small> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {product.variation2Name ? (
              <section className={"productOptionSection" + (promptChoice && !selectionComplete ? " needsChoice" : "")}>
                <div className="productOptionLabel">
                  <span>{product.variation2Name}</span>
                  <small>
                    {option2 || t("buy.pd.chooseOption")}
                  </small>
                </div>

                <div className="productOptionGrid">
                  {option2Values.map((value) => {
                    const soldOut = option2SoldOut(value);
                    const selected = option2 === value;

                    return (
                      <button
                        type="button"
                        key={value}
                        disabled={!option1 || soldOut}
                        onClick={() => {
                          setOption2(value);
                          setQuantity(1);
                        }}
                        className={
                          "productOptionButton" +
                          (selected ? " selected" : "")
                        }
                      >
                        {value}
                        {soldOut ? <small>{t("card.soldOut")}</small> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <div className="productQuantityLine">
              <div>
                <span>{t("buy.pd.quantity")}</span>
                <small>
                  {selectionComplete
                    ? stockCopy(
                        t,
                        typeof displayStock === "number"
                          ? displayStock
                          : undefined
                      )
                    : t("buy.pd.selectVariationFirst")}
                </small>
              </div>

              <div className="quantityStepper detailQuantityStepper">
                <button
                  type="button"
                  disabled={quantity <= 1 || !canBuy}
                  onClick={() =>
                    setQuantity((current) => Math.max(1, current - 1))
                  }
                >
                  −
                </button>
                <strong>{quantity}</strong>
                <button
                  type="button"
                  disabled={!canBuy || quantity >= maxQuantity}
                  onClick={() =>
                    setQuantity((current) =>
                      Math.min(maxQuantity, current + 1)
                    )
                  }
                >
                  +
                </button>
              </div>
            </div>

            <div className="desktopPurchaseActions">
              <button
                type="button"
                className="productAddCartButton"
                disabled={outOfStock || !cartReady}
                onClick={addCurrentToCart}
              >
                <span>＋</span>
                {outOfStock ? t("buy.pd.outOfStock") : t("buy.pd.addToCart")}
              </button>

              <button
                type="button"
                className="productBuyNowButton"
                disabled={outOfStock || !cartReady}
                onClick={buyNow}
              >
                {t("buy.pd.buyNow")}
              </button>
            </div>

            <div className="productServiceRows">
              <div>
                <span>✓</span>
                <p>
                  <strong>
                    {product.sellerTier === "direct"
                      ? t("buy.pd.shipsFromWarehouse")
                      : t("buy.pd.shipsFromShop")}
                  </strong>
                  <small>
                    {product.sellerTier === "direct"
                      ? t("buy.pd.soldByMivo")
                      : t("buy.pd.shipsFromShopHint", { shop: product.seller || "MIVO" })}
                  </small>
                </p>
              </div>
              <div>
                <span>✓</span>
                <p>
                  <strong>{t("buy.pd.malaysiaDelivery")}</strong>
                  <small>{t("buy.pd.shippingAtCheckout")}</small>
                </p>
              </div>
              <div>
                <span>✓</span>
                <p>
                  <strong>{t("buy.pd.accountSynced")}</strong>
                  <small>{t("buy.pd.accountSyncedHint")}</small>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="productInfoSection">
          <div className="productShopeeDetails">
            <section className="productSpecificationCard">
              <div className="productInfoSectionTitle">
                <span>{t("buy.pd.productDetails")}</span>
                <h2>{t("buy.pd.specifications")}</h2>
              </div>

              <div className="productSpecificationGrid">
                <div>
                  <span>{t("buy.pd.brand")}</span>
                  <strong>{product.brand}</strong>
                </div>
                <div>
                  <span>{t("buy.pd.category")}</span>
                  <strong>{product.category}</strong>
                </div>
                <div>
                  <span>SKU</span>
                  <strong>{displaySku || t("buy.pd.selectVariation")}</strong>
                </div>
                <div>
                  <span>{t("buy.pd.condition")}</span>
                  <strong>{t("buy.pd.new")}</strong>
                </div>
                {product.variation1Name ? (
                  <div>
                    <span>{product.variation1Name}</span>
                    <strong>
                      {selectedVariant?.variation1Value ||
                        option1 ||
                        t("buy.pd.selectVariation")}
                    </strong>
                  </div>
                ) : null}
                {product.variation2Name ? (
                  <div>
                    <span>{product.variation2Name}</span>
                    <strong>
                      {selectedVariant?.variation2Value ||
                        option2 ||
                        t("buy.pd.selectVariation")}
                    </strong>
                  </div>
                ) : null}
                <div>
                  <span>{t("buy.pd.warranty")}</span>
                  <strong>
                    {product.warrantyMonths
                      ? t("buy.pd.warrantyMonths", { n: product.warrantyMonths })
                      : t("buy.pd.notSpecified")}
                  </strong>
                </div>
                <div>
                  <span>{t("buy.pd.stock")}</span>
                  <strong>
                    {stockCopy(
                      t,
                      typeof displayStock === "number"
                        ? displayStock
                        : undefined
                    )}
                  </strong>
                </div>
                {selectedVariant?.weightKg ? (
                  <div>
                    <span>{t("buy.pd.weight")}</span>
                    <strong>{selectedVariant.weightKg} kg</strong>
                  </div>
                ) : null}
                {selectedVariant?.lengthCm &&
                selectedVariant?.widthCm &&
                selectedVariant?.heightCm ? (
                  <div>
                    <span>{t("buy.pd.packageSize")}</span>
                    <strong>
                      {selectedVariant.lengthCm} × {selectedVariant.widthCm} ×{" "}
                      {selectedVariant.heightCm} cm
                    </strong>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="productDescriptionCard productShopeeDescription">
              <div className="productInfoSectionTitle">
                <span>{t("buy.pd.description")}</span>
                <h2>{t("buy.pd.productDescription")}</h2>
              </div>

              <div className="productDescriptionBody">
                {descriptionParagraphs.length ? (
                  descriptionParagraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))
                ) : shortDescriptionText ? (
                  <p className="productShortDescription">
                    {shortDescriptionText}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="productWarrantyCard">
              <div className="productInfoSectionTitle">
                <span>{t("buy.pd.afterSales")}</span>
                <h2>{t("buy.pd.warranty")}</h2>
              </div>

              <div className="productWarrantySummary">
                <strong>
                  {product.warrantyMonths
                    ? t("buy.pd.warrantyMonths", { n: product.warrantyMonths })
                    : t("buy.pd.warrantyUnspecified")}
                </strong>
                <p>
                  {t("buy.pd.warrantyTerms")}
                </p>
              </div>
            </section>
          </div>
        </section>

        <section className="productReviewsSection">
          <div className="productReviewsHeader">
            <div>
              <span>{t("buy.pd.ratings")}</span>
              <h2>
                {displayRating.toFixed(1)}
                <small> / 5</small>
              </h2>
              <p>
                {Array.from({ length: 5 }, (_, index) =>
                  index < roundedRating ? "★" : "☆"
                ).join("")}
              </p>
            </div>

            <div className="productReviewFilters">
              <button
                type="button"
                className={reviewFilter === "all" ? "active" : ""}
                onClick={() => setReviewFilter("all")}
              >
                {t("buy.pd.filterAll", { n: productReviews.length })}
              </button>
              {[5, 4, 3, 2, 1].map((rating) => (
                <button
                  type="button"
                  key={rating}
                  className={reviewFilter === rating ? "active" : ""}
                  onClick={() =>
                    setReviewFilter(rating as 1 | 2 | 3 | 4 | 5)
                  }
                >
                  {t("buy.pd.filterStar", { rating, n: reviewCounts[rating] || 0 })}
                </button>
              ))}
              <button
                type="button"
                className={reviewFilter === "photos" ? "active" : ""}
                onClick={() => setReviewFilter("photos")}
              >
                {t("buy.pd.filterPhotos", {
                  n: productReviews.filter(
                    (review) => review.imageUrls.length > 0
                  ).length,
                })}
              </button>
            </div>
          </div>

          {filteredReviews.length > 0 ? (
            <div className="productReviewList">
              {filteredReviews.map((review) => (
                <article className="productReviewItem" key={review.id}>
                  <div className="productReviewBuyer">
                    <div className="productReviewAvatar">
                      {(review.reviewerName || t("buy.pd.customer")).slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <strong>{review.reviewerName || t("buy.pd.customer")}</strong>
                      <span>
                        {review.verifiedPurchase
                          ? t("buy.pd.verifiedPurchase")
                          : t("buy.pd.customerReview")}
                      </span>
                    </div>
                  </div>

                  <div className="productReviewBody">
                    <div className="productReviewStars">
                      {Array.from({ length: 5 }, (_, index) =>
                        index < review.rating ? "★" : "☆"
                      ).join("")}
                    </div>

                    <div className="productReviewMeta">
                      <span>
                        {new Date(review.createdAt).toLocaleDateString(
                          intlTag(locale),
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </span>
                      {review.variantName ? (
                        <span>{t("buy.pd.variation", { name: review.variantName })}</span>
                      ) : null}
                    </div>

                    {review.comment ? <p>{review.comment}</p> : null}

                    {review.imageUrls.length > 0 ? (
                      <div className="productReviewPhotos">
                        {review.imageUrls.map((url) => (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            key={url}
                          >
                            <img src={url} alt={t("buy.pd.customerReview")} />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="productReviewEmpty">
              <strong>{t("buy.pd.noReviews")}</strong>
              <span>{t("buy.pd.noReviewsHint")}</span>
            </div>
          )}
        </section>

        <CarRecommendations
          title="alsoFits"
          category={product.category}
          exclude={[product.id || product.slug]}
        />

        {relatedProducts.length > 0 ? (
          <section className="relatedProductsSection">
            <div className="relatedProductsHead">
              <div>
                <span>{t("buy.pd.relatedParts")}</span>
                <h2>{t("buy.pd.youMayLike")}</h2>
              </div>
              <Link href="/products">{t("buy.pd.viewAll")}</Link>
            </div>

            <div className="relatedProductsGrid">
              {relatedProducts.map((related) => (
                <ProductCard
                  key={related.slug}
                  product={related}
                  compact
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <ProductVehicleSelector
        open={vehicleSelectorOpen}
        onClose={() => setVehicleSelectorOpen(false)}
      />

      {fitmentConfirmAction ? (
        <div
          className="fitmentOverrideBackdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setFitmentConfirmAction(null);
            }
          }}
        >
          <div
            className="fitmentOverrideModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fitment-override-title"
          >
            <span>{t("buy.pd.fitmentWarning")}</span>
            <h2 id="fitment-override-title">
              {t("buy.pd.fitmentMismatch")}
            </h2>
            <p>
              {t("buy.pd.overrideBefore")}{" "}
              <strong>{selectedVehicleLabel}</strong>
              {t("buy.pd.overrideAfter")}
            </p>
            <div className="fitmentOverrideSummary">
              <small>{t("buy.pd.selectedPart")}</small>
              <strong>
                {[selectedVariant?.variation1Value, selectedVariant?.variation2Value]
                  .filter(Boolean)
                  .join(" / ") || product.name}
              </strong>
            </div>
            <div className="fitmentOverrideActions">
              <button
                type="button"
                className="fitmentOverrideCancel"
                onClick={() => setFitmentConfirmAction(null)}
              >
                {t("buy.pd.goBack")}
              </button>
              <button
                type="button"
                className="fitmentOverrideConfirm"
                onClick={confirmFitmentOverride}
              >
                {t("buy.pd.understandContinue")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mobileProductBar">
        <button
          type="button"
          className="mobileProductCart"
          disabled={outOfStock || !cartReady}
          onClick={addCurrentToCart}
        >
          <span>＋</span>
          {t("buy.pd.addToCart")}
        </button>

        <button
          type="button"
          className="mobileProductBuy"
          disabled={outOfStock || !cartReady}
          onClick={buyNow}
        >
          {t("buy.pd.buyNow")}
        </button>
      </div>
    </main>
  );
}
