"use client";
import Link from "next/link";
import type { Product } from "@/data/products";
import { formatPrice } from "@/data/products";
import { useMarketplace } from "./MarketplaceProvider";

export default function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { addToCart } = useMarketplace();
  const activeVariants = (product.variants || []).filter((variant) => variant.isActive);
  const requiresSelection = Boolean(product.variation1Name) || Boolean(product.variation2Name) || activeVariants.length > 1;
  const singleVariant = activeVariants.length === 1 ? activeVariants[0] : undefined;
  const soldOut = activeVariants.length > 0 ? activeVariants.every((variant) => variant.stock <= 0) : product.stock === 0;

  return (
    <article className={compact ? "productCard premiumProductCard" : "catalogCard premiumProductCard"}>
      <Link href={`/products/${product.slug}`} className={compact ? "productPicture premiumProductImage" : "catalogImage premiumProductImage"}>
        <span className="productCategoryLabel">{product.category}</span>
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} />
        ) : (
          <div className="productPlaceholder" aria-hidden="true">
            <span>{product.icon}</span>
            <i />
          </div>
        )}
        <span className="fitmentPill">FITMENT CHECK</span>
      </Link>
      <div className="productMeta">
        <div className="productBrandRow"><span>{product.brand}</span><span>★ {Math.min(5, 4.6 + product.reviews % 4 / 10).toFixed(1)}</span></div>
        <Link href={`/products/${product.slug}`}><h3>{product.name}</h3></Link>
        <p className="productFitmentText">Check compatibility with your vehicle</p>
        <div className="productBottom">
          <strong>{requiresSelection ? "From " : ""}{formatPrice(product.price)}</strong>
          {requiresSelection ? (
            <Link href={`/products/${product.slug}`} className="miniCartButton">OPTIONS</Link>
          ) : (
            <button className="miniCartButton" type="button" disabled={soldOut} onClick={() => addToCart(product, singleVariant)}>
              {soldOut ? "SOLD OUT" : "ADD"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}