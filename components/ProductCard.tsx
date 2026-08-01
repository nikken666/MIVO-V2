"use client";

import Link from "next/link";
import type { Product } from "@/data/products";
import { formatPrice } from "@/data/products";
import { useMarketplace } from "./MarketplaceProvider";

export default function ProductCard({
  product,
  compact = false,
}: {
  product: Product;
  compact?: boolean;
}) {
  const { addToCart } = useMarketplace();

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

  return (
    <article className={compact ? "productCard" : "catalogCard"}>
      <Link
        href={`/products/${product.slug}`}
        className={compact ? "productPicture" : "catalogImage"}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              borderRadius: 12,
            }}
          />
        ) : (
          product.icon
        )}
      </Link>

      <Link href={`/products/${product.slug}`}>
        <h3>{product.name}</h3>
      </Link>

      <span className={compact ? "productBrand" : "catalogBrand"}>
        {product.brand}
      </span>

      <strong>
        {requiresSelection ? "From " : ""}
        {formatPrice(product.price)}
      </strong>

      <div className="rating">
        ★★★★★ <span>({product.reviews})</span>
      </div>

      {requiresSelection ? (
        <Link
          href={`/products/${product.slug}`}
          className="miniCartButton"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
          }}
        >
          Choose Options
        </Link>
      ) : (
        <button
          className="miniCartButton"
          type="button"
          disabled={soldOut}
          onClick={() => addToCart(product, singleVariant)}
        >
          {soldOut ? "Out of Stock" : "Add to Cart"}
        </button>
      )}
    </article>
  );
}
