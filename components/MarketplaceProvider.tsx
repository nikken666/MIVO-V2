"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import type { Product, ProductVariant } from "@/data/products";
import { createClient } from "@/lib/supabase/client";
import {
  loadAccountCart,
  saveAccountCart,
  type AccountCartLine,
} from "@/lib/accountCart";

export type CartLine = AccountCartLine;

type CartNotice = {
  productName: string;
  quantity: number;
} | null;

type MarketplaceContextValue = {
  cart: CartLine[];
  cartCount: number;
  cartReady: boolean;
  buyNowLine: CartLine | null;
  startBuyNow: (product: Product, variant: ProductVariant, quantity?: number) => void;
  clearBuyNow: () => void;
  selectedCartLineIds: string[];
  toggleCartLineSelection: (lineId: string) => void;
  selectAllCartLines: (selected: boolean) => void;
  removeCartLines: (lineIds: string[]) => Promise<void>;
  addToCart: (
    product: Product,
    variant?: ProductVariant,
    quantity?: number
  ) => void;
  removeFromCart: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
};

const MarketplaceContext =
  createContext<MarketplaceContextValue | null>(null);

const GUEST_CART_KEY = "mivo-cart:guest";
const LEGACY_CART_KEY = "mivo-cart";
const SELECTION_KEY_PREFIX = "mivo-cart-selection:";
const BUY_NOW_KEY = "mivo-checkout:buy-now";

function readBuyNowLine(): CartLine | null {
  try {
    const raw = window.sessionStorage.getItem(BUY_NOW_KEY);
    if (!raw) return null;
    const line = JSON.parse(raw) as Partial<CartLine>;
    if (
      !line || !line.product || !line.variant?.id ||
      !Number.isFinite(line.quantity) || Number(line.quantity) < 1
    ) return null;
    return {
      lineId: createLineId(line.product, line.variant),
      product: line.product,
      variant: line.variant,
      quantity: Math.max(1, Math.floor(Number(line.quantity))),
    };
  } catch {
    return null;
  }
}

function writeBuyNowLine(line: CartLine | null) {
  try {
    if (line) window.sessionStorage.setItem(BUY_NOW_KEY, JSON.stringify(line));
    else window.sessionStorage.removeItem(BUY_NOW_KEY);
  } catch {}
}


function selectionStorageKey(userId: string | null) {
  return SELECTION_KEY_PREFIX + (userId || "guest");
}

function readCartSelection(lines: CartLine[], userId: string | null): string[] {
  try {
    const raw = window.localStorage.getItem(selectionStorageKey(userId));
    if (raw !== null) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved)) {
        const ids = new Set(saved.filter((id): id is string => typeof id === "string"));
        return lines.filter((line) => ids.has(line.lineId)).map((line) => line.lineId);
      }
    }
  } catch {}
  return lines.map((line) => line.lineId);
}

function writeCartSelection(lineIds: string[], userId: string | null) {
  try {
    window.localStorage.setItem(selectionStorageKey(userId), JSON.stringify(lineIds));
  } catch {}
}


function createLineId(product: Product, variant?: ProductVariant) {
  return product.slug + "::" + (variant?.id || variant?.sku || "default");
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

function readGuestCart() {
  try {
    const guestRaw = window.localStorage.getItem(GUEST_CART_KEY);
    if (guestRaw) return normalizeSavedCart(JSON.parse(guestRaw));

    const legacyRaw = window.localStorage.getItem(LEGACY_CART_KEY);
    if (legacyRaw) return normalizeSavedCart(JSON.parse(legacyRaw));
  } catch {}

  return [];
}

function writeGuestCart(cart: CartLine[]) {
  try {
    window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
    window.localStorage.removeItem(LEGACY_CART_KEY);
  } catch {}
}

function clearGuestCart() {
  try {
    window.localStorage.removeItem(GUEST_CART_KEY);
    window.localStorage.removeItem(LEGACY_CART_KEY);
    window.localStorage.removeItem(selectionStorageKey(null));
  } catch {}
}

function lineMaximum(line: CartLine) {
  if (typeof line.variant?.stock === "number") return line.variant.stock;
  if (typeof line.product.stock === "number") return line.product.stock;
  return undefined;
}

function mergeCarts(accountCart: CartLine[], guestCart: CartLine[]) {
  const merged = new Map<string, CartLine>();

  for (const line of accountCart) {
    merged.set(line.lineId, { ...line });
  }

  for (const line of guestCart) {
    const existing = merged.get(line.lineId);

    if (!existing) {
      merged.set(line.lineId, { ...line });
      continue;
    }

    const maximum = lineMaximum(line);
    const combined = existing.quantity + line.quantity;

    merged.set(line.lineId, {
      ...line,
      quantity:
        typeof maximum === "number"
          ? Math.min(maximum, combined)
          : combined,
    });
  }

  return Array.from(merged.values());
}

export default function MarketplaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [buyNowLine, setBuyNowLine] = useState<CartLine | null>(null);
  const [selectedCartLineIds, setSelectedCartLineIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<CartNotice>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncSequence = useRef(0);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function syncSession(user: User | null) {
      const sequence = ++syncSequence.current;
      setHydrated(false);

      if (!user) {
        const guestCart = readGuestCart();

        if (!active || sequence !== syncSequence.current) return;

        writeGuestCart(guestCart);
        setUserId(null);
        setCart(guestCart);
        setBuyNowLine(readBuyNowLine());
        setSelectedCartLineIds(readCartSelection(guestCart, null));
        setHydrated(true);
        return;
      }

      let accountCart: CartLine[] = [];

      try {
        accountCart = await loadAccountCart();
      } catch {
        accountCart = [];
      }

      const guestCart = readGuestCart();
      const merged =
        guestCart.length > 0
          ? mergeCarts(accountCart, guestCart)
          : accountCart;
      const checked = new Set([
        ...readCartSelection(accountCart, user.id),
        ...readCartSelection(guestCart, null),
      ]);

      if (guestCart.length > 0) {
        try {
          await saveAccountCart(merged);
          clearGuestCart();
        } catch {}
      }

      if (!active || sequence !== syncSequence.current) return;

      setUserId(user.id);
      setCart(merged);
      setBuyNowLine(readBuyNowLine());
      setSelectedCartLineIds(merged.filter((line) => checked.has(line.lineId)).map((line) => line.lineId));
      setHydrated(true);
    }

    supabase.auth
      .getUser()
      .then(({ data }) => {
        void syncSession(data.user);
      })
      .catch(() => {
        void syncSession(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session?.user || null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();

      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
    }

    if (!userId) {
      writeGuestCart(cart);
      return;
    }

    persistTimer.current = setTimeout(() => {
      void saveAccountCart(cart)
        .then(() => clearGuestCart())
        .catch(() => {});
    }, 250);

    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [cart, hydrated, userId]);

  useEffect(() => {
    if (!hydrated) return;
    writeCartSelection(selectedCartLineIds, userId);
  }, [selectedCartLineIds, hydrated, userId]);

  function showAddedNotice(productName: string, quantity: number) {
    setNotice({ productName, quantity });

    if (noticeTimer.current) clearTimeout(noticeTimer.current);

    noticeTimer.current = setTimeout(() => {
      setNotice(null);
    }, 2600);
  }

  const value = useMemo<MarketplaceContextValue>(
    () => ({
      cart,
      cartCount: cart.reduce(
        (total, line) => total + line.quantity,
        0
      ),

      cartReady: hydrated,
      buyNowLine,
      startBuyNow: (product, variant, quantity = 1) => {
        const requested = Math.max(1, Math.floor(Number(quantity) || 1));
        const maximum = lineMaximum({
          lineId: createLineId(product, variant), product, variant, quantity: requested,
        });
        const line: CartLine = {
          lineId: createLineId(product, variant),
          product, variant,
          quantity: typeof maximum === "number" ? Math.min(maximum, requested) : requested,
        };
        writeBuyNowLine(line);
        setBuyNowLine(line);
      },
      clearBuyNow: () => {
        writeBuyNowLine(null);
        setBuyNowLine(null);
      },
      selectedCartLineIds,
      toggleCartLineSelection: (lineId) => {
        setSelectedCartLineIds((current) =>
          current.includes(lineId)
            ? current.filter((id) => id !== lineId)
            : [...current, lineId]
        );
      },
      selectAllCartLines: (selected) => {
        setSelectedCartLineIds(selected ? cart.map((line) => line.lineId) : []);
      },
      removeCartLines: async (lineIds) => {
        const removed = new Set(lineIds);
        const remaining = cart.filter((line) => !removed.has(line.lineId));
        if (persistTimer.current) clearTimeout(persistTimer.current);
        if (userId) {
          await saveAccountCart(remaining);
          clearGuestCart();
        } else {
          writeGuestCart(remaining);
        }
        setCart(remaining);
        setSelectedCartLineIds((current) => current.filter((id) => !removed.has(id)));
      },

      addToCart: (product, variant, quantity = 1) => {
        const requestedQuantity = Math.max(
          1,
          Math.floor(Number(quantity) || 1)
        );
        const lineId = createLineId(product, variant);
        const found = cart.find((line) => line.lineId === lineId);
        const maximum =
          typeof variant?.stock === "number"
            ? variant.stock
            : typeof product.stock === "number"
              ? product.stock
              : undefined;

        let nextCart: CartLine[];

        if (found) {
          const nextQuantity = found.quantity + requestedQuantity;

          nextCart = cart.map((line) =>
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
        } else {
          nextCart = [
            ...cart,
            {
              lineId,
              product,
              variant,
              quantity:
                typeof maximum === "number"
                  ? Math.min(maximum, requestedQuantity)
                  : requestedQuantity,
            },
          ];
        }

        // Persist the cart before route changes and fast navigation.
        writeGuestCart(nextCart);
        setCart(nextCart);
        setSelectedCartLineIds((current) =>
          current.includes(lineId) ? current : [...current, lineId]
        );

        showAddedNotice(product.name, requestedQuantity);
      },

      removeFromCart: (lineId) => {
        setCart((current) => current.filter((line) => line.lineId !== lineId));
        setSelectedCartLineIds((current) => current.filter((id) => id !== lineId));
      },

      updateQuantity: (lineId, quantity) =>
        setCart((current) =>
          current.map((line) => {
            if (line.lineId !== lineId) return line;

            const maximum = lineMaximum(line);
            const safeQuantity = Math.max(
              1,
              Math.floor(Number(quantity) || 1)
            );

            return {
              ...line,
              quantity:
                typeof maximum === "number"
                  ? Math.min(maximum, safeQuantity)
                  : safeQuantity,
            };
          })
        ),

      clearCart: () => {
        setCart([]);
        setSelectedCartLineIds([]);
      },
    }),
    [cart, hydrated, selectedCartLineIds, buyNowLine, userId]
  );

  return (
    <MarketplaceContext.Provider value={value}>
      {children}

      {notice ? (
        <div className="cartSuccessToast" role="status" aria-live="polite">
          <div className="cartSuccessIcon">✓</div>
          <div className="cartSuccessCopy">
            <strong>Added to cart</strong>
            <span>
              {notice.quantity} × {notice.productName}
            </span>
          </div>
          <Link href="/cart">VIEW CART →</Link>
        </div>
      ) : null}
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
