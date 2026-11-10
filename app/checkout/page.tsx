"use client";

import Link from "next/link";
import { voucherAllowed, voucherUses } from "@/lib/vouchers";
import "./mobile.css";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useMarketplace } from "@/components/MarketplaceProvider";
import {
  formatPrice,
  type Product,
  type ProductVariant,
} from "@/data/products";
import {
  loadDefaultAddress,
  saveDefaultAddress,
  type AccountAddress,
} from "@/lib/customerData";
import { useT } from "@/components/LanguageProvider";
import ShopBadge from "@/components/ShopBadge";
import type { Translate } from "@/lib/i18n";
import { intlTag } from "@/lib/i18n/format";
import { friendlyError } from "@/lib/i18n/errors";
import FreeShippingProgress from "@/components/FreeShippingProgress";
import { trackBeginCheckout } from "@/lib/analytics";

type Buyer = {
  email: string;
  fullName: string;
};

type CheckoutResult = {
  order_number: string;
};

type ShippingQuote = {
  courier_code: string;
  courier_name: string;
  courier_cost: number;
  handling_markup: number;
  zone_code: string;
  zone_name: string;
  state: string;
  chargeable_weight_kg: number;
  subtotal: number;
  shipping_amount: number;
  total_amount: number;
};

// One parcel per shop (supabase/checkout-per-shop.sql).
type ShopQuote = {
  seller_id: string;
  // Shops shipping from the same address are one parcel.
  seller_ids?: string[];
  shop_name: string;
  tier: string | null;
  options: ShippingQuote[];
};

type VoucherOption = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: "fixed" | "percent" | "free_shipping";
  discount_value: number | string;
  minimum_spend: number | string;
  max_discount: number | string | null;
  first_order_only: boolean;
  new_user_only?: boolean | null;
  per_user_limit?: number | string | null;
  scope_type: "all" | "brand" | "category" | "product";
  starts_at: string;
  ends_at: string;
};

type VoucherPreview = {
  voucher_id: string;
  code: string;
  name: string;
  discount_type: string;
  discount_amount: number;
  total_after_discount: number;
};

type AddonSuggestion = {
  product: Product;
  variant: ProductVariant;
  price: number;
};

function voucherScopeLabel(t: Translate, scope: VoucherOption["scope_type"]) {
  if (scope === "brand") return t("buy.co.scopeBrand");
  if (scope === "category") return t("buy.co.scopeCategory");
  if (scope === "product") return t("buy.co.scopeProduct");
  return t("buy.co.scopeAll");
}

function voucherValidLabel(value: string) {
  return new Date(value).toLocaleDateString(intlTag(), {
    day: "2-digit",
    month: "short",
  });
}

function friendlyVoucherReason(t: Translate, message: string) {
  const value = message.toLowerCase();

  if (value.includes("first orders only")) {
    return t("buy.co.rFirstOrder");
  }

  if (value.includes("already used")) {
    return t("buy.co.rUsed");
  }

  if (value.includes("usage limit")) {
    return t("buy.co.rLimit");
  }

  if (value.includes("does not apply")) {
    return t("buy.co.rScope");
  }

  if (value.includes("not available")) {
    return t("buy.co.rUnavailable");
  }

  if (value.includes("claim this voucher")) {
    return t("buy.co.rClaim");
  }

  return message || t("buy.co.rDefault");
}

export default function CheckoutPage() {
  const t = useT();
  const router = useRouter();
  const {
    cart,
    cartReady,
    buyNowLine,
    clearBuyNow,
    selectedCartLineIds,
    addToCart,
    removeCartLines,
  } = useMarketplace();

  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedAddress, setSavedAddress] = useState<AccountAddress | null>(null);
  const [addressExpanded, setAddressExpanded] = useState(false);
  const [addressFilled, setAddressFilled] = useState(false);
  const checkoutFormRef = useRef<HTMLFormElement>(null);
  function checkAddress(form: HTMLFormElement) {
    const value = (name: string) => String((form.elements.namedItem(name) as HTMLInputElement | null)?.value || "").trim();
    const filled = Boolean(value("full_name") && value("phone") && value("address_line_1") && value("postcode") && value("state"));
    setAddressFilled((current) => (current === filled ? current : filled));
  }
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [voucherExpanded, setVoucherExpanded] = useState(false);
  const [shippingState, setShippingState] = useState("");
  const [shippingPostcode, setShippingPostcode] = useState("");
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (checkoutFormRef.current) checkAddress(checkoutFormRef.current);
    });
    return () => window.cancelAnimationFrame(frame);
  });
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([]);
  const [selectedCourier, setSelectedCourier] = useState("");
  // Per-shop shipping when available; null = single courier for the order (older database).
  const [shopQuotes, setShopQuotes] = useState<ShopQuote[] | null>(null);
  const [shopCourier, setShopCourier] = useState<Record<string, string>>({});
  // Live EasyParcel shipping quote (saved server-side); "" = MIVO's own rules.
  const [liveQuoteId, setLiveQuoteId] = useState("");
  // MIVO-funded free shipping promotion running now (supabase/checkout-per-shop.sql).
  const [shippingPromo, setShippingPromo] = useState<{ name: string; min_spend: number; max_subsidy: number | null } | null>(null);
  useEffect(() => {
    void createClient()
      .rpc("active_shipping_promotion")
      .then(({ data }) => setShippingPromo((data as { name: string; min_spend: number; max_subsidy: number | null } | null) || null));
  }, []);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [vouchers, setVouchers] = useState<VoucherOption[]>([]);
  const [selectedVoucherId, setSelectedVoucherId] = useState("");
  const [voucherPreview, setVoucherPreview] =
    useState<VoucherPreview | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState("");

  useEffect(() => {
    const supabase = createClient();

    async function checkSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?next=/checkout");
        return;
      }

      let profileName = "";

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (typeof profile?.full_name === "string") {
          profileName = profile.full_name.trim();
        }
      } catch {}

      try {
        const address = await loadDefaultAddress();
        setSavedAddress(address);
        if (address?.state) setShippingState(address.state);
        if (address?.postcode) setShippingPostcode(address.postcode);
      } catch {}

      const metadataName =
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name.trim()
          : "";

      setBuyer({
        email: user.email || "",
        fullName:
          profileName ||
          metadataName ||
          user.email?.split("@")[0] ||
          "",
      });

      try {
        const [
          { data: claimed },
          { data: redemptions },
          { count: paidOrderCount },
        ] = await Promise.all([
          supabase
            .from("customer_vouchers")
            .select("voucher_id")
            .eq("user_id", user.id),
          supabase
            .from("voucher_redemptions")
            .select("voucher_id, status")
            .eq("user_id", user.id)
            .in("status", ["reserved", "redeemed"]),
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .in("status", ["paid", "processing", "packed", "shipped", "delivered", "completed"]),
        ]);

        const uses = voucherUses(redemptions as Array<{ voucher_id: string; status: string }> | null);

        const ids =
          ((claimed as Array<{ voucher_id: string }> | null) || [])
            .map((row) => row.voucher_id);

        if (ids.length > 0) {
          const { data: voucherData } = await supabase
            .from("vouchers")
            .select("*")
            .in("id", ids)
            .eq("is_active", true)
            .order("created_at", { ascending: true });

          const now = Date.now();
          const available = ((voucherData as VoucherOption[] | null) || []).filter(
            (voucher) => {
              const startsAt = new Date(voucher.starts_at).getTime();
              const endsAt = new Date(voucher.ends_at).getTime();
              if (Number.isFinite(startsAt) && startsAt > now) return false;
              if (Number.isFinite(endsAt) && endsAt < now) return false;
              return voucherAllowed(voucher, { paidOrders: Number(paidOrderCount || 0), claimed: true, uses });
            }
          );

          setVouchers(available);
        } else {
          setVouchers([]);
        }
      } catch {
        setVouchers([]);
      }

      setLoading(false);
    }

    void checkSession();
  }, [router]);

  const selectedCart = useMemo(
    () => buyNowLine
      ? [buyNowLine]
      : cart.filter((line) => selectedCartLineIds.includes(line.lineId)),
    [cart, selectedCartLineIds, buyNowLine]
  );
  const selectedCount = selectedCart.reduce((sum, line) => sum + line.quantity, 0);
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current || !cartReady || !selectedCart.length) return;
    checkoutTracked.current = true;
    trackBeginCheckout(
      selectedCart.map((line) => ({
        id: line.product.id || line.product.slug,
        name: line.product.name,
        price: Number(line.variant?.price ?? line.product.price) || 0,
        quantity: line.quantity,
        brand: line.product.brand,
        category: line.product.category,
        variant: line.variant?.title || null,
      }))
    );
  }, [cartReady, selectedCart]);

  const subtotal = selectedCart.reduce((sum, line) => {
    const price = line.variant?.price ?? line.product.price;
    return sum + price * line.quantity;
  }, 0);

  // Per shop: the chosen option of every shop; the order pays the sum.
  const shopChoices = shopQuotes
    ? shopQuotes.map(
        (shop) =>
          shop.options.find((option) => option.courier_code === shopCourier[shop.seller_id]) ||
          shop.options[0] ||
          null
      )
    : [];
  const shippingQuote: ShippingQuote | null = shopQuotes
    ? shopChoices.length && shopChoices.every(Boolean)
      ? {
          ...(shopChoices[0] as ShippingQuote),
          shipping_amount: shopChoices.reduce(
            (sum, option) => sum + Number(option?.shipping_amount || 0),
            0
          ),
        }
      : null
    : shippingQuotes.find(
        (quote) => quote.courier_code === selectedCourier
      ) ||
      shippingQuotes[0] ||
      null;

  const checkoutItems = selectedCart
    .map((line) =>
      line.variant?.id
        ? {
            variant_id: line.variant.id,
            quantity: line.quantity,
          }
        : null
    )
    .filter(
      (
        item
      ): item is {
        variant_id: string;
        quantity: number;
      } => Boolean(item)
    );

  const checkoutItemsKey = checkoutItems.map((item) => item.variant_id + ":" + item.quantity).join("|");

  const discountAmount = Number(voucherPreview?.discount_amount || 0);
  const grossShipping = Number(shippingQuote?.shipping_amount || 0);
  const promoReached = Boolean(shippingPromo && subtotal >= Number(shippingPromo.min_spend));
  const shippingSubsidy =
    shippingQuote && promoReached
      ? Math.min(grossShipping, shippingPromo?.max_subsidy != null ? Number(shippingPromo.max_subsidy) : grossShipping)
      : 0;
  const netShipping = Math.max(0, grossShipping - shippingSubsidy);
  const checkoutTotal = shippingQuote
    ? Math.max(0, subtotal + netShipping - discountAmount)
    : subtotal;

  const selectedVoucher =
    vouchers.find((voucher) => voucher.id === selectedVoucherId) || null;
  const selectedMinimumSpend = Number(selectedVoucher?.minimum_spend || 0);
  const voucherShortfall = selectedVoucher
    ? Math.max(0, selectedMinimumSpend - subtotal)
    : 0;
  const voucherProgress =
    selectedMinimumSpend > 0
      ? Math.min(100, (subtotal / selectedMinimumSpend) * 100)
      : 100;

  const cartVariantIds = new Set(
    cart
      .map((line) => line.variant?.id)
      .filter((value): value is string => Boolean(value))
  );

  const addonSuggestions: AddonSuggestion[] =
    !buyNowLine && voucherShortfall > 0 && voucherShortfall <= 100
      ? Array.from(
          new Map(
            selectedCart
              .flatMap((line) =>
                (line.product.variants || [])
                  .filter(
                    (variant) =>
                      variant.isActive &&
                      variant.stock > 0 &&
                      !cartVariantIds.has(variant.id)
                  )
                  .map((variant) => ({
                    product: line.product,
                    variant,
                    price: Number(variant.price),
                  }))
              )
              .sort(
                (a, b) =>
                  Math.abs(a.price - voucherShortfall) -
                  Math.abs(b.price - voucherShortfall)
              )
              .map((item) => [item.variant.id, item] as const)
          ).values()
        ).slice(0, 3)
      : [];

  const voucherReason =
    selectedVoucher && voucherShortfall > 0
      ? t("buy.co.addMoreToUse", {
          amount: formatPrice(voucherShortfall),
          code: selectedVoucher.code,
          min: formatPrice(selectedMinimumSpend),
        })
      : voucherError
        ? friendlyVoucherReason(t, voucherError)
        : "";

  useEffect(() => {
    let active = true;

    async function quote() {
      if (
        !shippingState ||
        !/^\d{5}$/.test(shippingPostcode) ||
        selectedCart.length === 0
      ) {
        setShippingQuotes([]);
        setShippingError("");
        return;
      }

      const items = selectedCart.map((line) => {
        if (!line.variant?.id) return null;
        return {
          variant_id: line.variant.id,
          quantity: line.quantity,
        };
      });

      if (items.some((item) => item === null)) {
        setShippingQuotes([]);
        setShippingError(
          t("buy.co.invalidSku")
        );
        return;
      }

      setShippingLoading(true);
      setShippingError("");

      try {
        const supabase = createClient();

        // Live EasyParcel prices per shop first.
        const live = await fetch("/api/shipping/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items, state: shippingState, postcode: shippingPostcode }),
        })
          .then(async (response) => (response.ok ? ((await response.json()) as { quoteId: string; shops: Array<{ seller_id: string; seller_ids?: string[]; shop_name: string; tier: string | null; amount: number }> }) : null))
          .catch(() => null);
        if (!active) return;
        if (live?.quoteId) {
          const shops: ShopQuote[] = live.shops.map((shop) => ({
            seller_id: shop.seller_id,
            seller_ids: shop.seller_ids,
            shop_name: shop.shop_name,
            tier: shop.tier,
            options: [
              {
                courier_code: "easyparcel",
                courier_name: "",
                courier_cost: shop.amount,
                handling_markup: 0,
                zone_code: "",
                zone_name: "",
                state: shippingState,
                chargeable_weight_kg: 0,
                subtotal: 0,
                shipping_amount: shop.amount,
                total_amount: 0,
              },
            ],
          }));
          setLiveQuoteId(live.quoteId);
          setShopQuotes(shops);
          setShippingQuotes([]);
          setShopCourier(Object.fromEntries(shops.map((shop) => [shop.seller_id, "easyparcel"])));
          return;
        }
        setLiveQuoteId("");

        // MIVO's shipping rules: per-shop quotes, else one courier for the whole order.
        const { data: byShop, error: byShopError } = await supabase.rpc(
          "quote_shipping_by_shop",
          {
            p_items: items,
            p_state: shippingState,
            p_postcode: shippingPostcode,
          }
        );
        if (!byShopError && Array.isArray(byShop)) {
          if (!active) return;
          const shops = (byShop as ShopQuote[]).map((shop) => ({
            ...shop,
            options: (shop.options || [])
              .slice()
              .sort((a, b) => Number(a.shipping_amount) - Number(b.shipping_amount)),
          }));
          setShopQuotes(shops);
          setShippingQuotes([]);
          setShopCourier((current) => {
            const next: Record<string, string> = {};
            for (const shop of shops) {
              // Couriers aren't shown to buyers: price each parcel at the cheapest option.
              next[shop.seller_id] = shop.options[0]?.courier_code || "";
            }
            return next;
          });
          if (shops.some((shop) => shop.options.length === 0)) {
            setShippingError(t("buy.co.unavailable"));
          }
          return;
        }
        setShopQuotes(null);

        const { data, error: quoteError } = await supabase.rpc(
          "quote_shipping_options",
          {
            p_items: items,
            p_state: shippingState,
            p_postcode: shippingPostcode,
          }
        );

        if (quoteError) throw quoteError;
        if (!active) return;

        const options = ((data as ShippingQuote[] | null) || [])
          .slice()
          .sort(
            (a, b) =>
              Number(a.shipping_amount) -
              Number(b.shipping_amount)
          );

        setShippingQuotes(options);
        setSelectedCourier((current) =>
          options.some(
            (quote) => quote.courier_code === current
          )
            ? current
            : options[0]?.courier_code || ""
        );
      } catch (caught) {
        if (!active) return;
        setShippingQuotes([]);
        setShippingError(
          friendlyError(caught, t, "buy.co.shippingFailed")
        );
      } finally {
        if (active) setShippingLoading(false);
      }
    }

    void quote();

    return () => {
      active = false;
    };
  }, [selectedCart, shippingState, shippingPostcode]);

  useEffect(() => {
    let active = true;

    async function preview() {
      if (!selectedVoucherId || !shippingQuote || checkoutItems.length !== selectedCart.length) {
        setVoucherPreview(null);
        setVoucherError("");
        return;
      }

      const voucher = vouchers.find(
        (item) => item.id === selectedVoucherId
      );

      if (
        voucher &&
        subtotal < Number(voucher.minimum_spend || 0)
      ) {
        setVoucherPreview(null);
        setVoucherError("");
        setVoucherLoading(false);
        return;
      }

      setVoucherLoading(true);
      setVoucherError("");

      try {
        const supabase = createClient();
        const { data, error: previewError } = await supabase.rpc(
          "preview_voucher",
          {
            p_voucher_id: selectedVoucherId,
            p_items: checkoutItems,
            p_shipping_amount: netShipping,
          }
        );

        if (previewError) throw previewError;
        if (!active) return;

        setVoucherPreview(data as VoucherPreview);
      } catch (caught) {
        if (!active) return;
        setVoucherPreview(null);
        setVoucherError(
          friendlyError(caught, t, "buy.co.voucherCannotApply")
        );
      } finally {
        if (active) setVoucherLoading(false);
      }
    }

    void preview();

    return () => {
      active = false;
    };
  }, [
    selectedVoucherId,
    shippingQuote?.courier_code,
    shippingQuote?.shipping_amount,
    subtotal,
    selectedCart.length,
    checkoutItemsKey,
    vouchers,
  ]);

  async function applyBestVoucher() {
    if (!shippingQuote || vouchers.length === 0) return;

    setVoucherLoading(true);
    setVoucherError("");

    try {
      const supabase = createClient();
      const results = await Promise.all(
        vouchers.map(async (voucher) => {
          const { data, error } = await supabase.rpc("preview_voucher", {
            p_voucher_id: voucher.id,
            p_items: checkoutItems,
            p_shipping_amount: netShipping,
          });

          return error
            ? null
            : (data as VoucherPreview);
        })
      );

      const best = results
        .filter((value): value is VoucherPreview => Boolean(value))
        .sort(
          (a, b) =>
            Number(b.discount_amount || 0) -
            Number(a.discount_amount || 0)
        )[0];

      if (!best) {
        setVoucherError(t("buy.co.noEligible"));
        return;
      }

      setSelectedVoucherId(best.voucher_id);
      setVoucherPreview(best);
    } finally {
      setVoucherLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (
      !selectedCart.length ||
      !shippingState ||
      !/^\d{5}$/.test(shippingPostcode) ||
      !shippingQuote
    ) {
      setError(
        shippingError ||
          t("buy.co.enterPostcodeState")
      );
      return;
    }

    setBusy(true);

    try {
      const form = new FormData(event.currentTarget);
      const supabase = createClient();

      // Some products (e.g. oil, coolant) can't be sent to East Malaysia.
      const productIds = Array.from(new Set(selectedCart.map((line) => line.product.id).filter(Boolean))) as string[];
      if (productIds.length) {
        const { data: limits } = await supabase
          .from("products")
          .select("name, restricted_shipping_states")
          .in("id", productIds);
        const blocked = ((limits || []) as Array<{ name: string; restricted_shipping_states: string[] | null }>).filter((p) =>
          (p.restricted_shipping_states || []).includes(shippingState)
        );
        if (blocked.length) {
          setError(t("buy.co.cannotShipTo", { state: shippingState, items: blocked.map((p) => p.name).join(", ") }));
          setBusy(false);
          return;
        }
      }

      const items = selectedCart.map((line) => {
        if (!line.variant?.id) {
          throw new Error(
            t("buy.co.productInvalidSku", { name: line.product.name })
          );
        }

        return {
          variant_id: line.variant.id,
          quantity: line.quantity,
        };
      });

      const shippingAddress = {
        full_name: String(form.get("full_name") || "").trim(),
        phone: String(form.get("phone") || "").trim(),
        address_line_1: String(
          form.get("address_line_1") || ""
        ).trim(),
        address_line_2: String(
          form.get("address_line_2") || ""
        ).trim(),
        city: String(form.get("city") || "").trim(),
        state: String(form.get("state") || "").trim(),
        postcode: String(form.get("postcode") || "").trim(),
        country_code: "MY",
        courier_code: shopQuotes ? shippingQuote?.courier_code || "" : selectedCourier,
      };

      try {
        const saved = await saveDefaultAddress({
          ...shippingAddress,
          label: "Default",
        });
        if (saved) setSavedAddress(saved);
      } catch {}

      const orderNote = String(form.get("customer_note") || "").trim() || null;
      const { data, error: checkoutError } = shopQuotes
        ? await supabase.rpc("create_pending_order_by_shop", {
            p_items: items,
            p_shipping_address: shippingAddress,
            p_customer_note: orderNote,
            p_voucher_id: selectedVoucherId || null,
            p_couriers: liveQuoteId
              ? {}
              : Object.fromEntries(
                  shopQuotes.map((shop, index) => [shop.seller_id, shopChoices[index]?.courier_code || ""])
                ),
            p_quote_id: liveQuoteId || null,
          })
        : await supabase.rpc("create_pending_order", {
            p_items: items,
            p_shipping_address: shippingAddress,
            p_customer_note: orderNote,
            p_voucher_id: selectedVoucherId || null,
          });

      if (checkoutError) throw checkoutError;

      const order = data as CheckoutResult | null;

      if (!order?.order_number) {
        throw new Error(t("buy.co.noOrderNumber"));
      }

      const paymentResponse = await fetch(
        "/api/payments/stripe/checkout",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderNumber: order.order_number,
          }),
        }
      );

      const payment = (await paymentResponse.json()) as {
        url?: string;
        error?: string;
      };

      if (paymentResponse.ok && payment.url) {
        if (buyNowLine) {
          // Buy Now is independent: nothing was added to or removed from the cart.
          clearBuyNow();
        } else {
          try {
            await removeCartLines(selectedCart.map((line) => line.lineId));
          } catch (cartError) {
            console.error("Unable to sync purchased cart items:", cartError);
          }
        }
        window.location.assign(payment.url);
        return;
      }

      // Keep the cart intact when payment session creation fails so the buyer can retry.
      window.location.assign(
        "/orders/" +
          encodeURIComponent(order.order_number) +
          "?created=1&payment=unavailable"
      );
    } catch (caught) {
      // Shoppers see a plain message; the database detail goes to the console.
      console.warn("[MIVO] checkout", caught);
      setError(friendlyError(caught, t, "buy.co.createFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !cartReady) {
    return (
      <main className="checkoutPage">
        <div className="container checkoutLoading">
          <span>{t("buy.co.eyebrow")}</span>
          <strong>
            {loading ? t("buy.co.preparing") : t("buy.cart.loading")}
          </strong>
        </div>
      </main>
    );
  }

  if (!cart.length && !buyNowLine) {
    return (
      <main className="checkoutPage">
        <div className="container">
          <div className="cartEmpty">
            <span>{t("buy.co.eyebrow")}</span>
            <h1>{t("buy.cart.empty")}</h1>
            <p>{t("buy.co.addProductFirst")}</p>
            <Link href="/products" className="cartPrimaryButton">
              {t("buy.cart.shopParts")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!selectedCart.length) {
    return (
      <main className="checkoutPage">
        <div className="container">
          <div className="cartEmpty">
            <span>{t("buy.co.eyebrow")}</span>
            <h1>{t("buy.co.noneSelected")}</h1>
            <p>{t("buy.co.noneSelectedHint")}</p>
            <Link href="/cart" className="cartPrimaryButton">{t("buy.co.backToCart")}</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="checkoutPage">
      <div className="checkoutTopBand">
        <div className="container checkoutTopInner">
          <Link href="/cart">{t("buy.co.backToCartArrow")}</Link>

          {/* A7: address → shipping → payment, filling in as each part is ready */}
          <ol className="checkoutLiveSteps" aria-label={t("buy.co.progress")}>
            {[
              { label: t("buy.co.stepAddress"), done: addressFilled },
              { label: t("buy.co.stepShipping"), done: addressFilled && Boolean(shippingQuote) },
              { label: t("buy.co.stepPayment"), done: busy },
            ].map((step, index, list) => {
              const active = !step.done && list.slice(0, index).every((before) => before.done);
              return (
                <li key={index} className={step.done ? "done" : active ? "active" : ""} aria-current={active ? "step" : undefined}>
                  <b>{step.done ? "✓" : index + 1}</b>
                  <span>{step.label}</span>
                </li>
              );
            })}
          </ol>

          <span>{t("header.secure")}</span>
        </div>
      </div>

      <div className="container checkoutShell">
        <div className="checkoutPageHeader">
          <span className="cartEyebrow">{t("buy.co.eyebrow")}</span>
          <h1>{t("buy.co.title")}</h1>
          <p>
            {t("buy.co.signedInAs")} <strong>{buyer?.email}</strong>
          </p>
        </div>

        <div className="checkoutLayout">
          <form className="checkoutFormCard" onSubmit={submit} onInput={(event) => checkAddress(event.currentTarget)} ref={checkoutFormRef}>
            <div className="checkoutSectionHead">
              <div>
                <span>01</span>
                <div>
                  <small>{t("buy.co.delivery")}</small>
                  <h2>{t("buy.co.shippingDetails")}</h2>
                </div>
              </div>
              <strong>{t("buy.co.malaysia")}</strong>
            </div>

            <div className="mivoMobileAddressCard">
              <div className="mivoMobileAddressInfo">
                <strong>{t("buy.co.shippingAddress")}</strong>
                {savedAddress && !addressExpanded ? (
                  <><span>{savedAddress.full_name} · {savedAddress.phone}</span><small>{[savedAddress.address_line_1, savedAddress.address_line_2, savedAddress.postcode, savedAddress.city, savedAddress.state].filter(Boolean).join(", ")}</small></>
                ) : <small>{t("buy.co.enterAddress")}</small>}
              </div>
              <button type="button" onClick={() => setAddressExpanded(value => !value)}>{addressExpanded ? t("buy.co.done") : savedAddress ? t("buy.co.change") : t("buy.co.edit")}</button>
            </div>
            <div className={"mivoAddressEditor" + (savedAddress && !addressExpanded ? " collapsed" : "")}> 
            <div className="checkoutAccountSaveNote">
              <span>{savedAddress ? t("buy.co.savedLoaded") : t("buy.co.accountSave")}</span>
              <p>
                {savedAddress
                  ? t("buy.co.savedLoadedHint")
                  : t("buy.co.accountSaveHint")}
              </p>
            </div>

            <div className="checkoutFields">
              <label className="checkoutField checkoutFieldFull">
                <span>{t("buy.co.fullName")}</span>
                <input
                  name="full_name"
                  required
                  defaultValue={savedAddress?.full_name || buyer?.fullName}
                  placeholder={t("buy.co.recipientName")}
                />
              </label>

              <label className="checkoutField checkoutFieldFull">
                <span>{t("buy.co.phone")}</span>
                <input
                  name="phone"
                  required
                  defaultValue={savedAddress?.phone || ""}
                  placeholder="01X-XXXXXXX"
                  inputMode="tel"
                />
              </label>

              <label className="checkoutField checkoutFieldFull">
                <span>{t("buy.co.address1")}</span>
                <input
                  name="address_line_1"
                  required
                  defaultValue={savedAddress?.address_line_1 || ""}
                  placeholder={t("buy.co.address1Ph")}
                />
              </label>

              <label className="checkoutField checkoutFieldFull">
                <span>{t("buy.co.address2")}</span>
                <input
                  name="address_line_2"
                  defaultValue={savedAddress?.address_line_2 || ""}
                  placeholder={t("buy.co.address2Ph")}
                />
              </label>

              <label className="checkoutField">
                <span>{t("buy.co.postcode")}</span>
                <input
                  name="postcode"
                  required
                  value={shippingPostcode}
                  onChange={(event) => {
                    const value = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 5);
                    setShippingPostcode(value);
                    setSelectedCourier("");
                  }}
                  placeholder="75000"
                  inputMode="numeric"
                  pattern="[0-9]{5}"
                />
              </label>

              <label className="checkoutField">
                <span>{t("buy.co.city")}</span>
                <input
                  name="city"
                  required
                  defaultValue={savedAddress?.city || ""}
                  placeholder={t("buy.co.cityPh")}
                />
              </label>

              <label className="checkoutField checkoutFieldFull">
                <span>{t("buy.co.state")}</span>
                <select
                  name="state"
                  required
                  value={shippingState}
                  onChange={(event) => {
                    setShippingState(event.target.value);
                    setSelectedCourier("");
                  }}
                >
                  <option value="" disabled>
                    {t("buy.co.chooseState")}
                  </option>
                  <option>Johor</option>
                  <option>Kedah</option>
                  <option>Kelantan</option>
                  <option>W.P. Kuala Lumpur</option>
                  <option>W.P. Labuan</option>
                  <option>Melaka</option>
                  <option>Negeri Sembilan</option>
                  <option>Pahang</option>
                  <option>Penang</option>
                  <option>Perak</option>
                  <option>Perlis</option>
                  <option>W.P. Putrajaya</option>
                  <option>Sabah</option>
                  <option>Sarawak</option>
                  <option>Selangor</option>
                  <option>Terengganu</option>
                </select>
              </label>

            </div>
            </div>
            <button className="mivoMobileToggleNote" type="button" onClick={() => setNoteExpanded(value => !value)}>{noteExpanded ? t("buy.co.hideNote") : t("buy.co.addNote")}</button>
              <label className={"checkoutField checkoutFieldFull mivoNoteEditor" + (noteExpanded ? " expanded" : "")}>
                <span>{t("buy.co.orderNote")}</span>
                <textarea
                  name="customer_note"
                  rows={3}
                  placeholder={t("buy.co.orderNotePh")}
                />
              </label>


            {shippingState ? (
              <div
                className={
                  "checkoutShippingQuote" +
                  (shippingError ? " error" : "")
                }
              >
                <div>
                  <span>{t("buy.co.deliveryMethod")}</span>
                  <strong>
                    {shippingLoading
                      ? t("buy.co.calculating")
                      : shopQuotes
                        ? t("buy.co.perShop")
                        : shippingQuotes.length
                          ? t("buy.co.standardDelivery")
                          : t("buy.co.unavailable")}
                  </strong>
                </div>

                {shopQuotes ? (
                  <div className="checkoutShopParcels">
                    {shopQuotes.map((shop, index) => {
                      const members = shop.seller_ids?.length ? shop.seller_ids : [shop.seller_id];
                      const lines = selectedCart.filter((line) =>
                        members.includes(String(line.product.sellerId))
                      );
                      const chosen = shopChoices[index];
                      return (
                        <section className="checkoutShopParcel" key={shop.seller_id}>
                          <header>
                            <span className="checkoutShopDot">{shop.shop_name.slice(0, 1)}</span>
                            <strong>{shop.shop_name}</strong>
                            <ShopBadge tier={shop.tier as "direct" | "preferred" | "standard" | null} />
                            <small>{t("buy.co.parcelN", { n: index + 1 })}</small>
                          </header>
                          <ul>
                            {lines.map((line) => (
                              <li key={line.lineId}>
                                <span>{line.product.name}</span>
                                <small>× {line.quantity}</small>
                              </li>
                            ))}
                          </ul>
                          {shop.options.length ? (
                            <div className="checkoutStandardDelivery">
                              <span>
                                <strong>{t("buy.co.standardDelivery")}</strong>
                                <small>{t("buy.co.standardDeliveryHint")}</small>
                              </span>
                              <b>
                                {chosen
                                  ? Number(chosen.shipping_amount) === 0
                                    ? t("buy.co.free")
                                    : formatPrice(Number(chosen.shipping_amount))
                                  : "—"}
                              </b>
                            </div>
                          ) : (
                            <small>{t("buy.co.unavailable")}</small>
                          )}
                        </section>
                      );
                    })}
                  </div>
                ) : shippingQuote ? (
                  <div className="checkoutStandardDelivery">
                    <span>
                      <strong>{t("buy.co.standardDelivery")}</strong>
                      <small>{t("buy.co.standardDeliveryHint")}</small>
                    </span>
                    <b>
                      {shippingQuote.shipping_amount === 0
                        ? t("buy.co.free")
                        : formatPrice(shippingQuote.shipping_amount)}
                    </b>
                  </div>
                ) : shippingError ? (
                  <small>{shippingError}</small>
                ) : null}
              </div>
            ) : null}

            {error ? <p className="checkoutError">{error}</p> : null}

            <div className="checkoutActionRow">
              <div>
                <span>{t("buy.co.orderTotal")}</span>
                <strong>
                  {formatPrice(checkoutTotal)}
                </strong>
                <small>
                  {shippingQuote
                    ? t("buy.co.includesShipping")
                    : t("buy.co.chooseStateToCalc")}
                </small>
              </div>

              <button
                type="submit"
                className="checkoutPlaceOrder"
                disabled={
                  busy ||
                  !selectedCart.length ||
                  shippingLoading ||
                  voucherLoading ||
                  !shippingQuote ||
                  Boolean(selectedVoucherId && !voucherPreview)
                }
              >
                <span>
                  <small>{busy ? t("buy.co.processing") : t("buy.co.finalStep")}</small>
                  {busy ? t("buy.pay.opening") : t("buy.co.placeOrder")}
                </span>
                <b></b>
              </button>
            </div>
          </form>

          <aside className="checkoutSummaryCard">
            <div className="checkoutSummaryHead">
              <div>
                <span>{t("buy.co.yourOrder")}</span>
                <strong>
                  {t("buy.co.itemCount", { n: selectedCount })}
                </strong>
              </div>
              <Link href="/cart">{t("buy.co.editCart")}</Link>
            </div>

            <div className="checkoutItems">
              {selectedCart.map((line) => {
                const price =
                  line.variant?.price ?? line.product.price;

                return (
                  <article
                    className="checkoutItem"
                    key={line.lineId}
                  >
                    <div className="checkoutItemImage">
                      {line.product.imageUrl ? (
                        <img
                          src={line.product.imageUrl}
                          alt={line.product.name}
                        />
                      ) : (
                        <span>{line.product.icon}</span>
                      )}
                      <b>{line.quantity}</b>
                    </div>

                    <div className="checkoutItemInfo">
                      <span>{line.product.brand}</span>
                      <strong>{line.product.name}</strong>
                      {line.variant ? (
                        <small>
                          {line.variant.title}
                        </small>
                      ) : null}
                    </div>

                    <strong className="checkoutItemPrice">
                      {formatPrice(price * line.quantity)}
                    </strong>
                  </article>
                );
              })}
            </div>

            <div className="checkoutSummaryRows">
              <div>
                <span>{t("buy.cart.subtotal")}</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
              <div>
                <span>{t("buy.cart.shipping")}</span>
                <strong>
                  {!shippingState
                    ? t("buy.co.chooseState")
                    : !/^\d{5}$/.test(shippingPostcode)
                      ? t("buy.co.enterPostcode")
                      : shippingLoading
                      ? t("buy.co.calculating")
                      : shippingQuote
                        ? shippingQuote.shipping_amount === 0
                          ? t("buy.co.free")
                          : formatPrice(
                              shippingQuote.shipping_amount
                            )
                        : t("buy.co.unavailable")}
                </strong>
              </div>
              {shippingSubsidy > 0 ? (
                <div className="checkoutFreeShipping">
                  <span>{t("buy.co.freeShippingMivo")}</span>
                  <strong>− {formatPrice(shippingSubsidy)}</strong>
                </div>
              ) : null}
              {shippingPromo && shippingQuote ? (
                <FreeShippingProgress subtotal={subtotal} promo={shippingPromo} />
              ) : null}
            </div>

            <div className="mivoMobileVoucherToggle">
              <span>{t("buy.co.voucherPromo")} <small>{t("buy.co.nAvailable", { n: vouchers.length })}</small></span>
              <button type="button" onClick={() => setVoucherExpanded(value => !value)}>{voucherExpanded ? t("buy.co.close") : t("buy.co.choose")}</button>
            </div>
            <div className={"checkoutVoucherBox mivoVoucherEditor" + (voucherExpanded ? " expanded" : "")}>
              <div className="checkoutVoucherHead">
                <div>
                  <span>{t("buy.co.mivoVoucher")}</span>
                  <strong>
                    {vouchers.length
                      ? t("buy.co.nClaimed", { n: vouchers.length })
                      : t("buy.co.noClaimed")}
                  </strong>
                </div>
                {vouchers.length > 0 && shippingQuote ? (
                  <button
                    type="button"
                    onClick={() => void applyBestVoucher()}
                    disabled={voucherLoading}
                  >
                    {t("buy.co.bestVoucher")}
                  </button>
                ) : (
                  <Link href="/">{t("buy.voucher.claim")}</Link>
                )}
              </div>

              {vouchers.length > 0 ? (
                <div className="checkoutVoucherOptions">
                  <button
                    type="button"
                    className={!selectedVoucherId ? "active" : ""}
                    onClick={() => {
                      setSelectedVoucherId("");
                      setVoucherPreview(null);
                      setVoucherError("");
                    }}
                  >
                    {t("buy.co.noVoucher")}
                  </button>

                  {vouchers.map((voucher) => {
                    const minSpend = Number(voucher.minimum_spend || 0);
                    const shortBy = Math.max(0, minSpend - subtotal);
                    const cap = Number(voucher.max_discount || 0);

                    return (
                      <button
                        type="button"
                        key={voucher.id}
                        className={
                          selectedVoucherId === voucher.id ? "active" : ""
                        }
                        onClick={() => setSelectedVoucherId(voucher.id)}
                      >
                        <strong>{voucher.code}</strong>
                        <span className="checkoutVoucherDiscount">
                          {voucher.name}
                        </span>

                        <div className="checkoutVoucherConditions">
                          <small>
                            {t("buy.voucher.minSpend", { amount: formatPrice(minSpend) })}
                          </small>

                          {cap > 0 ? (
                            <small>{t("buy.co.maxDiscount", { amount: formatPrice(cap) })}</small>
                          ) : null}

                          {voucher.first_order_only || voucher.new_user_only ? (
                            <small>{t(voucher.first_order_only ? "buy.co.firstOrderOnly" : "buy.co.newCustomerOnly")}</small>
                          ) : null}

                          {voucher.scope_type !== "all" ? (
                            <small>
                              {voucherScopeLabel(t, voucher.scope_type)}
                            </small>
                          ) : null}

                          <small>
                            {t("buy.co.validTill", { date: voucherValidLabel(voucher.ends_at) })}
                          </small>
                        </div>

                        {shortBy > 0 ? (
                          <em>
                            {t("buy.co.addMore", { amount: formatPrice(shortBy) })}
                          </em>
                        ) : (
                          <em className="eligible">{t("buy.co.eligible")}</em>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {voucherLoading ? (
                <small>{t("buy.co.checkingVoucher")}</small>
              ) : voucherPreview ? (
                <small className="success">
                  {t("buy.co.saves", {
                    code: voucherPreview.code,
                    amount: formatPrice(Number(voucherPreview.discount_amount)),
                  })}
                </small>
              ) : selectedVoucherId && voucherReason ? (
                <div className="checkoutVoucherUnavailable">
                  <div className="checkoutVoucherReason">
                    <strong>{t("buy.co.notAvailableYet")}</strong>
                    <p>{voucherReason}</p>
                  </div>

                  {selectedVoucher && voucherShortfall > 0 ? (
                    <>
                      <div className="checkoutVoucherProgress">
                        <div>
                          <span>
                            {formatPrice(subtotal)} /{" "}
                            {formatPrice(selectedMinimumSpend)}
                          </span>
                          <strong>
                            {Math.max(0, Math.round(voucherProgress))}%
                          </strong>
                        </div>
                        <i>
                          <b
                            style={{
                              width:
                                Math.max(
                                  2,
                                  Math.min(100, voucherProgress)
                                ) + "%",
                            }}
                          />
                        </i>
                        <small>
                          {t("buy.co.awayBefore")}{" "}
                          <strong>{formatPrice(voucherShortfall)}</strong>{" "}
                          {t("buy.co.awayAfter", { code: selectedVoucher.code })}
                        </small>
                      </div>

                      {voucherShortfall <= 100 ? (
                        <div className="checkoutAddonSection">
                          <div className="checkoutAddonHead">
                            <div>
                              <span>{t("buy.co.addonEyebrow")}</span>
                              <strong>
                                {t("buy.co.addonTitle")}
                              </strong>
                            </div>
                            <Link href="/products">{t("buy.co.moreParts")}</Link>
                          </div>

                          {addonSuggestions.length > 0 ? (
                            <div className="checkoutAddonGrid">
                              {addonSuggestions.map((item) => (
                                <article
                                  className="checkoutAddonCard"
                                  key={item.variant.id}
                                >
                                  <div className="checkoutAddonImage">
                                    {item.product.imageUrl ? (
                                      <img
                                        src={item.product.imageUrl}
                                        alt={item.product.name}
                                      />
                                    ) : (
                                      <span>{item.product.icon}</span>
                                    )}
                                  </div>

                                  <div className="checkoutAddonInfo">
                                    <span>{item.product.brand}</span>
                                    <strong>{item.variant.title}</strong>
                                    <small>{item.product.name}</small>
                                    <b>{formatPrice(item.price)}</b>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      addToCart(
                                        item.product,
                                        item.variant,
                                        1
                                      )
                                    }
                                  >
                                    {t("buy.co.add")}
                                  </button>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <div className="checkoutAddonEmpty">
                              <span>
                                {t("buy.co.noAddon")}
                              </span>
                              <Link href="/products">
                                {t("buy.co.browseToUnlock")}
                              </Link>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>

            {voucherPreview && discountAmount > 0 ? (
              <div className="checkoutDiscountRow">
                <span>{t("buy.co.voucherRow", { code: voucherPreview.code })}</span>
                <strong>− {formatPrice(discountAmount)}</strong>
              </div>
            ) : null}

            <div className="checkoutSummaryTotal">
              <div>
                <span>{t("buy.co.total")}</span>
                <small>
                  {shippingQuote
                    ? shippingQuote.zone_name || shippingState
                    : !shippingState
                      ? t("buy.co.awaitingState")
                      : t("buy.co.awaitingPostcode")}
                </small>
              </div>
              <strong>
                {formatPrice(checkoutTotal)}
              </strong>
            </div>

            <div className="checkoutAssurance">
              <span>{t("buy.co.assure1")}</span>
              <span>{t("buy.co.assure2")}</span>
              <span>{t("buy.co.assure3")}</span>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
