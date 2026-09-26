"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Product, ProductVariant } from "@/data/products";
import type { FitmentStatus } from "@/data/fitments";
import { formatPrice } from "@/data/products";
import { useMarketplace } from "./MarketplaceProvider";

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  );
}

export default function ProductDetailClient({
  product,
  fitmentStatus,
  variantFitmentStatuses = {},
  selectedVehicleLabel,
}: {
  product: Product;
  fitmentStatus?: FitmentStatus;
  variantFitmentStatuses?: Record<string, FitmentStatus>;
  selectedVehicleLabel?: string;
}) {
  const { addToCart } = useMarketplace();

  const images = useMemo(
    () =>
      Array.from(
        new Set(
          [product.imageUrl, ...(product.imageUrls || [])].filter(
            (url): url is string => Boolean(url)
          )
        )
      ),
    [product.imageUrl, product.imageUrls]
  );

  const [activeImage, setActiveImage] = useState(0);

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

  const selectableVariants = useMemo(() => {
    if (!selectedVehicleLabel) return activeVariants;

    if (confirmedFitmentVariants.length > 0) {
      return confirmedFitmentVariants;
    }

    return activeVariants.filter(
      (variant) =>
        variantFitmentStatuses[variant.id] !== "not-fit"
    );
  }, [
    activeVariants,
    confirmedFitmentVariants,
    selectedVehicleLabel,
    variantFitmentStatuses,
  ]);

  const option1Values = useMemo(
    () =>
      uniqueValues(
        selectableVariants.map(
          (variant) => variant.variation1Value
        )
      ),
    [selectableVariants]
  );

  const [option1, setOption1] = useState("");
  const [option2, setOption2] = useState("");
  const [quantity, setQuantity] = useState(1);

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
    selectedVariantFitmentStatus === "not-fit" ||
    (selectedVehicleLabel &&
      selectableVariants.length === 0);
  const confirmedFitmentCount =
    confirmedFitmentVariants.length;
  const canBuy =
    !fitmentBlocked &&
    selectionComplete &&
    Boolean(selectedVariant) &&
    Number(selectedVariant?.stock || 0) > 0;

  function selectOption1(value: string) {
    setOption1(value);
    setQuantity(1);

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

  function addCurrentToCart() {
    if (!selectedVariant || !canBuy) return;
    addToCart(product, selectedVariant, quantity);
    setQuantity(1);
  }

  function buyNow() {
    if (!selectedVariant || !canBuy) return;
    addToCart(product, selectedVariant, quantity);
    window.location.assign("/checkout");
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
          <Link href="/products">ALL PARTS</Link>
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
                    aria-label="Previous product image"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="galleryArrow galleryArrowRight"
                    onClick={nextImage}
                    aria-label="Next product image"
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
                    aria-label={"View product image " + (index + 1)}
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
                  {product.reviews} review{product.reviews === 1 ? "" : "s"}
                </span>
                {displaySku ? <span>SKU {displaySku}</span> : null}
              </div>
            </div>

            <div className="productPricePanel">
              <div>
                {displayComparePrice ? (
                  <del>{formatPrice(displayComparePrice)}</del>
                ) : null}
                <strong>{formatPrice(displayPrice)}</strong>
              </div>
              <span>PRICE</span>
            </div>

            <div
              className={
                "productFitmentCompact" +
                (selectedVariantFitmentStatus
                  ? " fitment-" + selectedVariantFitmentStatus
                  : "")
              }
            >
              <div>
                <span>VEHICLE FITMENT</span>
                <strong>
                  {selectedVariantFitmentStatus === "fits"
                    ? "✓ FITS YOUR VEHICLE"
                    : selectedVariantFitmentStatus === "not-fit"
                      ? "NOT COMPATIBLE"
                      : selectedVariantFitmentStatus === "universal"
                        ? "UNIVERSAL FIT"
                        : selectedVariantFitmentStatus === "unverified"
                          ? "FITMENT NOT VERIFIED"
                          : "SELECT YOUR VEHICLE"}
                </strong>
                {selectedVehicleLabel ? (
                  <>
                    <small>{selectedVehicleLabel}</small>
                    {confirmedFitmentCount > 0 ? (
                      <small>
                        {confirmedFitmentCount} compatible SKU
                        {confirmedFitmentCount === 1 ? "" : "s"} available
                      </small>
                    ) : null}
                  </>
                ) : null}
              </div>
              <Link href="/#fitment">
                {selectedVehicleLabel ? "CHANGE VEHICLE →" : "SELECT VEHICLE →"}
              </Link>
            </div>

            {product.variation1Name ? (
              <section className="productOptionSection">
                <div className="productOptionLabel">
                  <span>{product.variation1Name}</span>
                  <small>
                    {option1 || "Choose an option"}
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
                        {value}
                        {soldOut ? <small>SOLD OUT</small> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {product.variation2Name ? (
              <section className="productOptionSection">
                <div className="productOptionLabel">
                  <span>{product.variation2Name}</span>
                  <small>
                    {option2 || "Choose an option"}
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
                        {soldOut ? <small>SOLD OUT</small> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <div className="productQuantityLine">
              <div>
                <span>QUANTITY</span>
                <small>
                  {selectionComplete && typeof displayStock === "number"
                    ? displayStock > 0
                      ? displayStock + " available"
                      : "Out of stock"
                    : "Select variation first"}
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
                disabled={!canBuy}
                onClick={addCurrentToCart}
              >
                <span>＋</span>
                {fitmentBlocked
                  ? "NOT COMPATIBLE"
                  : !selectionComplete
                    ? "SELECT VARIATION"
                    : !canBuy
                      ? "OUT OF STOCK"
                      : "ADD TO CART"}
              </button>

              <button
                type="button"
                className="productBuyNowButton"
                disabled={!canBuy}
                onClick={buyNow}
              >
                BUY NOW
              </button>
            </div>

            <div className="productServiceRows">
              <div>
                <span>✓</span>
                <p>
                  <strong>MIVO Direct Store</strong>
                  <small>Sold and fulfilled by MIVO</small>
                </p>
              </div>
              <div>
                <span>✓</span>
                <p>
                  <strong>Malaysia delivery</strong>
                  <small>Shipping calculated at checkout</small>
                </p>
              </div>
              <div>
                <span>✓</span>
                <p>
                  <strong>Account synced</strong>
                  <small>Cart, address, orders and vehicle saved to your account</small>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="productInfoSection">
          <div className="productShopeeDetails">
            <section className="productSpecificationCard">
              <div className="productInfoSectionTitle">
                <span>PRODUCT DETAILS</span>
                <h2>Product Specifications</h2>
              </div>

              <div className="productSpecificationGrid">
                <div>
                  <span>Brand</span>
                  <strong>{product.brand}</strong>
                </div>
                <div>
                  <span>Category</span>
                  <strong>{product.category}</strong>
                </div>
                <div>
                  <span>SKU</span>
                  <strong>{displaySku || "Select a variation"}</strong>
                </div>
                <div>
                  <span>Condition</span>
                  <strong>New</strong>
                </div>
                <div>
                  <span>Warranty</span>
                  <strong>
                    {product.warrantyMonths
                      ? product.warrantyMonths +
                        " Month" +
                        (product.warrantyMonths === 1 ? "" : "s")
                      : "Not specified"}
                  </strong>
                </div>
                <div>
                  <span>Stock</span>
                  <strong>
                    {typeof displayStock === "number"
                      ? displayStock + " available"
                      : "Select a variation"}
                  </strong>
                </div>
                {selectedVariant?.weightKg ? (
                  <div>
                    <span>Weight</span>
                    <strong>{selectedVariant.weightKg} kg</strong>
                  </div>
                ) : null}
                {selectedVariant?.lengthCm &&
                selectedVariant?.widthCm &&
                selectedVariant?.heightCm ? (
                  <div>
                    <span>Package Size</span>
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
                <span>DESCRIPTION</span>
                <h2>Product Description</h2>
              </div>

              {product.shortDescription ? (
                <p className="productShortDescription">
                  {product.shortDescription}
                </p>
              ) : null}

              <p>{product.description}</p>
            </section>

            <section className="productWarrantyCard">
              <div className="productInfoSectionTitle">
                <span>AFTER-SALES</span>
                <h2>Warranty</h2>
              </div>

              <div className="productWarrantySummary">
                <strong>
                  {product.warrantyMonths
                    ? product.warrantyMonths +
                      " Month" +
                      (product.warrantyMonths === 1 ? "" : "s") +
                      " Warranty"
                    : "Warranty information not specified"}
                </strong>
                <p>
                  Warranty eligibility is subject to the product condition,
                  order record and the applicable warranty terms.
                </p>
              </div>
            </section>
          </div>
        </section>
      </div>

      <div className="mobileProductBar">
        <button
          type="button"
          className="mobileProductCart"
          disabled={!canBuy}
          onClick={addCurrentToCart}
        >
          <span>＋</span>
          ADD TO CART
        </button>

        <button
          type="button"
          className="mobileProductBuy"
          disabled={!canBuy}
          onClick={buyNow}
        >
          BUY NOW
        </button>
      </div>
    </main>
  );
}
