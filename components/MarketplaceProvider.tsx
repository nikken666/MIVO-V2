"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "../data/products";

type CartLine = { product: Product; quantity: number };
type MarketplaceContextValue = {
  cart: CartLine[];
  cartCount: number;
  addToCart: (product: Product) => void;
  removeFromCart: (slug: string) => void;
  updateQuantity: (slug: string, quantity: number) => void;
  clearCart: () => void;
};

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null);

export default function MarketplaceProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("mivo-cart");
      if (saved) setCart(JSON.parse(saved) as CartLine[]);
    } catch {
      setCart([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("mivo-cart", JSON.stringify(cart));
  }, [cart]);

  const value = useMemo<MarketplaceContextValue>(() => ({
    cart,
    cartCount: cart.reduce((total, line) => total + line.quantity, 0),
    addToCart: (product) => setCart((current) => {
      const found = current.find((line) => line.product.slug === product.slug);
      if (found) return current.map((line) => line.product.slug === product.slug ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { product, quantity: 1 }];
    }),
    removeFromCart: (slug) => setCart((current) => current.filter((line) => line.product.slug !== slug)),
    updateQuantity: (slug, quantity) => setCart((current) => current.map((line) => line.product.slug === slug ? { ...line, quantity: Math.max(1, quantity) } : line)),
    clearCart: () => setCart([]),
  }), [cart]);

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
}

export function useMarketplace() {
  const value = useContext(MarketplaceContext);
  if (!value) throw new Error("useMarketplace must be used inside MarketplaceProvider");
  return value;
}
