"use client";
import Link from "next/link";
import type { Product } from "../data/products";
import { formatPrice } from "../data/products";
import { useMarketplace } from "./MarketplaceProvider";

export default function ProductDetailClient({ product }: { product: Product }) {
  const { addToCart } = useMarketplace();
  return <main className="container pageShell"><Link href="/products" className="backLink">← Back to products</Link><section className="productDetail"><div className="productDetailImage">{product.icon}</div><div><span className="detailBrand">{product.brand}</span><h1>{product.name}</h1><div className="rating">★★★★★ <span>({product.reviews} reviews)</span></div><h2 className="detailPrice">{formatPrice(product.price)}</h2><p>{product.description}</p><div className="fitmentBox"><strong>Fitment check available</strong><span>Select your vehicle or contact MIVO support before ordering.</span></div><button className="redButton detailCartButton" onClick={() => addToCart(product)}>Add to Cart</button></div></section></main>;
}
