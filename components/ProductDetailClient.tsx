"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Product, ProductVariant } from "@/data/products";
import { formatPrice } from "@/data/products";
import { useMarketplace } from "./MarketplaceProvider";

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  );
}

export default function ProductDetailClient({
  product,
}: {
  product: Product;
}) {
  const { addToCart } = useMarketplace();

  const activeVariants = useMemo(
    () =>
      (product.variants || []).filter((variant) => variant.isActive),
    [product.variants]
  );

  const option1Values = useMemo(
    () =>
      uniqueValues(
        activeVariants.map((variant) => variant.variation1Value)
      ),
    [activeVariants]
  );

  const [option1, setOption1] = useState("");
  const [option2, setOption2] = useState("");

  const option2Values = useMemo(
    () =>
      uniqueValues(
        activeVariants
          .filter(
            (variant) =>
              !product.variation1Name ||
              !option1 ||
              variant.variation1Value === option1
          )
          .map((variant) => variant.variation2Value)
      ),
    [activeVariants, option1, product.variation1Name]
  );

  const selectedVariant = useMemo(() => {
    if (!product.variation1Name && !product.variation2Name) {
      return activeVariants[0];
    }

    return activeVariants.find(
      (variant) =>
        (!product.variation1Name ||
          variant.variation1Value === option1) &&
        (!product.variation2Name ||
          variant.variation2Value === option2)
    );
  }, [
    activeVariants,
    option1,
    option2,
    product.variation1Name,
    product.variation2Name,
  ]);

  const selectionComplete =
    (!product.variation1Name || Boolean(option1)) &&
    (!product.variation2Name || Boolean(option2));

  const displayPrice = selectedVariant?.price ?? product.price;
  const displayStock = selectedVariant?.stock ?? product.stock;
  const displaySku = selectedVariant?.sku ?? product.sku;

  function selectOption1(value: string) {
    setOption1(value);

    if (
      option2 &&
      !activeVariants.some(
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
    return !activeVariants.some(
      (variant) =>
        variant.variation1Value === value && variant.stock > 0
    );
  }

  function option2SoldOut(value: string) {
    return !activeVariants.some(
      (variant) =>
        (!product.variation1Name ||
          variant.variation1Value === option1) &&
        variant.variation2Value === value &&
        variant.stock > 0
    );
  }

  return (
    <main className="container pageShell">
      <Link href="/products" className="backLink">
        ← Back to products
      </Link>

      <section className="productDetail">
        <div className="productDetailImage">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          ) : (
            product.icon
          )}
        </div>

        <div>
          <span className="detailBrand">{product.brand}</span>
          <h1>{product.name}</h1>

          <div className="rating">
            ★★★★★ <span>({product.reviews} reviews)</span>
          </div>

          <h2 className="detailPrice">{formatPrice(displayPrice)}</h2>

          {product.seller && <p>Sold by: {product.seller}</p>}

          {product.variation1Name && (
            <section style={{ margin: "22px 0 14px" }}>
              <strong style={{ display: "block", marginBottom: 10 }}>
                {product.variation1Name}
              </strong>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                {option1Values.map((value) => {
                  const soldOut = option1SoldOut(value);
                  const selected = option1 === value;

                  return (
                    <button
                      type="button"
                      key={value}
                      disabled={soldOut}
                      onClick={() => selectOption1(value)}
                      style={{
                        border: selected
                          ? "2px solid #e60012"
                          : "1px solid #d8d8dc",
                        background: selected ? "#fff1f2" : "#fff",
                        color: soldOut ? "#a0a0a5" : "#161619",
                        borderRadius: 9,
                        padding: "10px 14px",
                        fontWeight: 800,
                        cursor: soldOut ? "not-allowed" : "pointer",
                      }}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {product.variation2Name && (
            <section style={{ margin: "14px 0 22px" }}>
              <strong style={{ display: "block", marginBottom: 10 }}>
                {product.variation2Name}
              </strong>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                {option2Values.map((value) => {
                  const soldOut = option2SoldOut(value);
                  const selected = option2 === value;

                  return (
                    <button
                      type="button"
                      key={value}
                      disabled={!option1 || soldOut}
                      onClick={() => setOption2(value)}
                      style={{
                        border: selected
                          ? "2px solid #e60012"
                          : "1px solid #d8d8dc",
                        background: selected ? "#fff1f2" : "#fff",
                        color:
                          !option1 || soldOut ? "#a0a0a5" : "#161619",
                        borderRadius: 9,
                        padding: "10px 14px",
                        fontWeight: 800,
                        cursor:
                          !option1 || soldOut ? "not-allowed" : "pointer",
                      }}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {displaySku && <p>SKU: {displaySku}</p>}

          {selectionComplete &&
            typeof displayStock === "number" && (
              <p>
                {displayStock > 0
                  ? `${displayStock} units available`
                  : "Out of stock"}
              </p>
            )}

          <p>{product.description}</p>

          <div className="fitmentBox">
            <strong>Fitment check available</strong>
            <span>
              Select your vehicle or contact MIVO support before ordering.
            </span>
          </div>

          <button
            className="redButton detailCartButton"
            disabled={
              !selectionComplete ||
              !selectedVariant ||
              selectedVariant.stock <= 0
            }
            onClick={() => {
              if (selectedVariant) {
                addToCart(product, selectedVariant);
              }
            }}
          >
            {!selectionComplete
              ? "Select Variation"
              : !selectedVariant || selectedVariant.stock <= 0
                ? "Out of Stock"
                : "Add to Cart"}
          </button>
        </div>
      </section>
    </main>
  );
}
