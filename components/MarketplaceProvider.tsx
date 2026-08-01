"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Product, ProductVariant } from "@/data/products";

export type CartLine = {
  lineId: string;
  product: Product;
  variant?: ProductVariant;
  quantity: number;
};

type MarketplaceContextValue = {
  cart: CartLine[];
  cartCount: number;
  addToCart: (product: Product, variant?: ProductVariant) => void;
  removeFromCart: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
};

const MarketplaceContext =
  createContext<MarketplaceContextValue | null>(null);

function createLineId(product: Product, variant?: ProductVariant) {
  return `${product.slug}::${variant?.id || variant?.sku || "default"}`;
}

function normalizeSavedCart(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (line): line is Partial<CartLine> & { product: Product } =>
        Boolean(
          line &&
            typeof line === "object" &&
            "product" in line &&
            line.product
        )
    )
    .map((line) => ({
      lineId:
        typeof line.lineId === "string"
          ? line.lineId
          : createLineId(line.product, line.variant),
      product: line.product,
      variant: line.variant,
      quantity:
        typeof line.quantity === "number" && line.quantity > 0
          ? Math.floor(line.quantity)
          : 1,
    }));
}

export default function MarketplaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("mivo-cart");
      if (saved) setCart(normalizeSavedCart(JSON.parse(saved)));
    } catch {
      setCart([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("mivo-cart", JSON.stringify(cart));
  }, [cart]);

  const value = useMemo<MarketplaceContextValue>(
    () => ({
      cart,
      cartCount: cart.reduce(
        (total, line) => total + line.quantity,
        0
      ),

      addToCart: (product, variant) =>
        setCart((current) => {
          const lineId = createLineId(product, variant);
          const found = current.find((line) => line.lineId === lineId);

          if (found) {
            const maximum = variant?.stock;
            const nextQuantity = found.quantity + 1;

            return current.map((line) =>
              line.lineId === lineId
                ? {
                    ...line,
                    quantity:
                      typeof maximum === "number"
                        ? Math.min(maximum, nextQuantity)
                        : nextQuantity,
                  }
                : line
            );
          }

          return [
            ...current,
            {
              lineId,
              product,
              variant,
              quantity: 1,
            },
          ];
        }),

      removeFromCart: (lineId) =>
        setCart((current) =>
          current.filter((line) => line.lineId !== lineId)
        ),

      updateQuantity: (lineId, quantity) =>
        setCart((current) =>
          current.map((line) => {
            if (line.lineId !== lineId) return line;

            const maximum = line.variant?.stock;
            const safeQuantity = Math.max(1, Math.floor(quantity || 1));

            return {
              ...line,
              quantity:
                typeof maximum === "number"
                  ? Math.min(maximum, safeQuantity)
                  : safeQuantity,
            };
          })
        ),

      clearCart: () => setCart([]),
    }),
    [cart]
  );

  return (
    <MarketplaceContext.Provider value={value}>
      {children}
    </MarketplaceContext.Provider>
  );
}

export function useMarketplace() {
  const value = useContext(MarketplaceContext);

  if (!value) {
    throw new Error(
      "useMarketplace must be used inside MarketplaceProvider"
    );
  }

  return value;
}
