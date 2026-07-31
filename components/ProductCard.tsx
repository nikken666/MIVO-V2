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

      <strong>{formatPrice(product.price)}</strong>

      {typeof product.stock === "number" && (
        <small>{product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}</small>
      )}

      <div className="rating">
        ★★★★★ <span>({product.reviews})</span>
      </div>

      <button
        className="miniCartButton"
        type="button"
        disabled={product.stock === 0}
        onClick={() => addToCart(product)}
      >
        {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
      </button>
    </article>
  );
}
