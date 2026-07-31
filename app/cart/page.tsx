"use client";

import Link from "next/link";
import { formatPrice } from "@/data/products";
import { useMarketplace } from "@/components/MarketplaceProvider";

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, clearCart } = useMarketplace();
  const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  if (!cart.length) return <main className="container pageShell"><div className="emptyState"><span>🛒</span><h1>Your cart is empty</h1><p>Add products to begin checkout.</p><Link href="/products" className="redButton inlineButton">Browse Products</Link></div></main>;
  return <main className="container pageShell"><div className="pageHeading"><div><h1>Shopping Cart</h1><p>{cart.length} product lines</p></div><button className="textButton" onClick={clearCart}>Clear cart</button></div><div className="cartLayout"><section className="cartLines">{cart.map((line) => <article className="cartLine" key={line.product.slug}><div className="cartIcon">{line.product.icon}</div><div><Link href={`/products/${line.product.slug}`}><h3>{line.product.name}</h3></Link><span>{line.product.brand}</span><strong>{formatPrice(line.product.price)}</strong></div><input aria-label="Quantity" type="number" min="1" value={line.quantity} onChange={(e) => updateQuantity(line.product.slug, Number(e.target.value))} /><button className="removeButton" onClick={() => removeFromCart(line.product.slug)}>Remove</button></article>)}</section><aside className="orderSummary"><h2>Order Summary</h2><div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div><div><span>Shipping</span><strong>Calculated later</strong></div><hr /><div className="summaryTotal"><span>Total</span><strong>{formatPrice(subtotal)}</strong></div><Link href="/login?next=checkout" className="redButton checkoutButton">Proceed to Checkout</Link><small>Payment gateway and live order creation are connected in the backend phase.</small></aside></div></main>;
}
