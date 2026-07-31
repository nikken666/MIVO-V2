"use client";

import Link from "next/link";
import type { Product } from "../data/products";
import { formatPrice } from "../data/products";
import { useMarketplace } from "./MarketplaceProvider";

export default function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { addToCart } = useMarketplace();
  return (
    <article className={compact ? "productCard" : "catalogCard"}>
      <Link href={`/products/${product.slug}`} className={compact ? "productPicture" : "catalogImage"}>{product.icon}</Link>
      <Link href={`/products/${product.slug}`}><h3>{product.name}</h3></Link>
      <span className={compact ? "productBrand" : "catalogBrand"}>{product.brand}</span>
      <strong>{formatPrice(product.price)}</strong>
      <div className="rating">★★★★★ <span>({product.reviews})</span></div>
      <button className="miniCartButton" type="button" onClick={() => addToCart(product)}>Add to Cart</button>
    </article>
  );
}
