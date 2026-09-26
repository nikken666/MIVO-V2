"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useMarketplace } from "@/components/MarketplaceProvider";
import { formatPrice } from "@/data/products";
import {
  loadDefaultAddress,
  saveDefaultAddress,
  type AccountAddress,
} from "@/lib/customerData";

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

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, cartCount, cartReady, clearCart } = useMarketplace();

  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedAddress, setSavedAddress] = useState<AccountAddress | null>(null);
  const [shippingState, setShippingState] = useState("");
  const [shippingPostcode, setShippingPostcode] = useState("");
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([]);
  const [selectedCourier, setSelectedCourier] = useState("");
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");

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

      setLoading(false);
    }

    void checkSession();
  }, [router]);

  const subtotal = cart.reduce((sum, line) => {
    const price = line.variant?.price ?? line.product.price;
    return sum + price * line.quantity;
  }, 0);

  const shippingQuote =
    shippingQuotes.find(
      (quote) => quote.courier_code === selectedCourier
    ) ||
    shippingQuotes[0] ||
    null;

  useEffect(() => {
    let active = true;

    async function quote() {
      if (
        !shippingState ||
        !/^\d{5}$/.test(shippingPostcode) ||
        cart.length === 0
      ) {
        setShippingQuotes([]);
        setShippingError("");
        return;
      }

      const items = cart.map((line) => {
        if (!line.variant?.id) return null;
        return {
          variant_id: line.variant.id,
          quantity: line.quantity,
        };
      });

      if (items.some((item) => item === null)) {
        setShippingQuotes([]);
        setShippingError(
          "One or more cart items do not have a valid SKU variation."
        );
        return;
      }

      setShippingLoading(true);
      setShippingError("");

      try {
        const supabase = createClient();
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
          caught instanceof Error
            ? caught.message
            : "Unable to calculate shipping."
        );
      } finally {
        if (active) setShippingLoading(false);
      }
    }

    void quote();

    return () => {
      active = false;
    };
  }, [cart, shippingState, shippingPostcode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (
      !shippingState ||
      !/^\d{5}$/.test(shippingPostcode) ||
      !shippingQuote
    ) {
      setError(
        shippingError ||
          "Enter a valid postcode and choose a delivery state."
      );
      return;
    }

    setBusy(true);

    try {
      const form = new FormData(event.currentTarget);
      const supabase = createClient();

      const items = cart.map((line) => {
        if (!line.variant?.id) {
          throw new Error(
            line.product.name + " does not have a valid SKU variation."
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
        courier_code: selectedCourier,
      };

      try {
        const saved = await saveDefaultAddress({
          ...shippingAddress,
          label: "Default",
        });
        if (saved) setSavedAddress(saved);
      } catch {}

      const { data, error: checkoutError } = await supabase.rpc(
        "create_pending_order",
        {
          p_items: items,
          p_shipping_address: shippingAddress,
          p_customer_note:
            String(form.get("customer_note") || "").trim() ||
            null,
        }
      );

      if (checkoutError) throw checkoutError;

      const order = data as CheckoutResult | null;

      if (!order?.order_number) {
        throw new Error("Order was created without an order number.");
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

      clearCart();

      if (paymentResponse.ok && payment.url) {
        window.location.assign(payment.url);
        return;
      }

      window.location.assign(
        "/orders/" +
          encodeURIComponent(order.order_number) +
          "?created=1&payment=unavailable"
      );
    } catch (caught) {
      const details = caught as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };

      setError(
        [
          details?.message,
          details?.details,
          details?.hint,
          details?.code ? "Error code: " + details.code : "",
        ]
          .filter(Boolean)
          .join(" | ") || "Unable to create order."
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading || !cartReady) {
    return (
      <main className="checkoutPage">
        <div className="container checkoutLoading">
          <span>MIVO CHECKOUT</span>
          <strong>
            {loading ? "Preparing your checkout..." : "Loading your cart..."}
          </strong>
        </div>
      </main>
    );
  }

  if (!cart.length) {
    return (
      <main className="checkoutPage">
        <div className="container">
          <div className="cartEmpty">
            <span>MIVO CHECKOUT</span>
            <h1>Your cart is empty.</h1>
            <p>Add a product before continuing to checkout.</p>
            <Link href="/products" className="cartPrimaryButton">
              SHOP PARTS →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="checkoutPage">
      <div className="checkoutTopBand">
        <div className="container checkoutTopInner">
          <Link href="/cart">← BACK TO CART</Link>

          <div className="checkoutSteps" aria-label="Checkout progress">
            <span className="done">01 CART</span>
            <i />
            <span className="active">02 DETAILS</span>
            <i />
            <span>03 ORDER</span>
          </div>

          <span>SECURE CHECKOUT</span>
        </div>
      </div>

      <div className="container checkoutShell">
        <div className="checkoutPageHeader">
          <span className="cartEyebrow">MIVO CHECKOUT</span>
          <h1>Complete your order.</h1>
          <p>
            Signed in as <strong>{buyer?.email}</strong>
          </p>
        </div>

        <div className="checkoutLayout">
          <form className="checkoutFormCard" onSubmit={submit}>
            <div className="checkoutSectionHead">
              <div>
                <span>01</span>
                <div>
                  <small>DELIVERY</small>
                  <h2>Shipping details</h2>
                </div>
              </div>
              <strong>MALAYSIA</strong>
            </div>

            <div className="checkoutAccountSaveNote">
              <span>{savedAddress ? "✓ SAVED ADDRESS LOADED" : "ACCOUNT SAVE"}</span>
              <p>
                {savedAddress
                  ? "Your default MIVO delivery address has been filled in automatically."
                  : "This delivery address will be saved to your MIVO account for your next checkout."}
              </p>
            </div>

            <div className="checkoutFields">
              <label className="checkoutField checkoutFieldFull">
                <span>FULL NAME *</span>
                <input
                  name="full_name"
                  required
                  defaultValue={savedAddress?.full_name || buyer?.fullName}
                  placeholder="Recipient name"
                />
              </label>

              <label className="checkoutField checkoutFieldFull">
                <span>PHONE NUMBER *</span>
                <input
                  name="phone"
                  required
                  defaultValue={savedAddress?.phone || ""}
                  placeholder="01X-XXXXXXX"
                  inputMode="tel"
                />
              </label>

              <label className="checkoutField checkoutFieldFull">
                <span>ADDRESS LINE 1 *</span>
                <input
                  name="address_line_1"
                  required
                  defaultValue={savedAddress?.address_line_1 || ""}
                  placeholder="House / unit number and street"
                />
              </label>

              <label className="checkoutField checkoutFieldFull">
                <span>ADDRESS LINE 2</span>
                <input
                  name="address_line_2"
                  defaultValue={savedAddress?.address_line_2 || ""}
                  placeholder="Building, area or landmark (optional)"
                />
              </label>

              <label className="checkoutField">
                <span>POSTCODE *</span>
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
                <span>CITY *</span>
                <input
                  name="city"
                  required
                  defaultValue={savedAddress?.city || ""}
                  placeholder="City"
                />
              </label>

              <label className="checkoutField checkoutFieldFull">
                <span>STATE *</span>
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
                    Choose state
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

              <label className="checkoutField checkoutFieldFull">
                <span>ORDER NOTE</span>
                <textarea
                  name="customer_note"
                  rows={3}
                  placeholder="Optional note for this order"
                />
              </label>
            </div>

            <label className="checkoutCancellationPolicy">
              <input
                type="checkbox"
                name="cancellation_policy_accepted"
                required
              />
              <span>
                <strong>Cancellation & refund policy</strong>
                <small>
                  Unpaid orders are cancelled automatically after 24 hours.
                  Paid orders may be cancelled before shipment. Paid
                  cancellations deduct the actual payment processing fee, a 3%
                  cancellation administration fee capped at RM20, and a RM2
                  service fee. Once shipped, the order cannot be cancelled.
                </small>
              </span>
            </label>

            {shippingState ? (
              <div
                className={
                  "checkoutShippingQuote" +
                  (shippingError ? " error" : "")
                }
              >
                <div>
                  <span>DELIVERY METHOD</span>
                  <strong>
                    {shippingLoading
                      ? "Calculating..."
                      : shippingQuotes.length
                        ? "Choose courier"
                        : "Unavailable"}
                  </strong>
                </div>

                {shippingQuotes.length > 0 ? (
                  <div className="checkoutCourierOptions">
                    {shippingQuotes.map((quote) => (
                      <button
                        type="button"
                        key={quote.courier_code}
                        className={
                          "checkoutCourierOption" +
                          (selectedCourier === quote.courier_code
                            ? " selected"
                            : "")
                        }
                        onClick={() =>
                          setSelectedCourier(quote.courier_code)
                        }
                      >
                        <span>
                          <strong>{quote.courier_name}</strong>
                          <small>
                            {quote.zone_name} ·{" "}
                            {Number(
                              quote.chargeable_weight_kg
                            ).toFixed(2)}{" "}
                            kg
                          </small>
                        </span>
                        <b>
                          {quote.shipping_amount === 0
                            ? "FREE"
                            : formatPrice(quote.shipping_amount)}
                        </b>
                      </button>
                    ))}
                  </div>
                ) : shippingError ? (
                  <small>{shippingError}</small>
                ) : null}
              </div>
            ) : null}

            {error ? <p className="checkoutError">{error}</p> : null}

            <div className="checkoutActionRow">
              <div>
                <span>ORDER TOTAL</span>
                <strong>
                  {formatPrice(
                    shippingQuote?.total_amount ?? subtotal
                  )}
                </strong>
                <small>
                  {shippingQuote
                    ? "Includes shipping"
                    : "Choose state to calculate shipping"}
                </small>
              </div>

              <button
                type="submit"
                className="checkoutPlaceOrder"
                disabled={
                  busy ||
                  shippingLoading ||
                  !shippingQuote
                }
              >
                <span>
                  <small>{busy ? "PROCESSING" : "FINAL STEP"}</small>
                  {busy ? "OPENING PAYMENT..." : "PLACE ORDER & PAY"}
                </span>
                <b>→</b>
              </button>
            </div>
          </form>

          <aside className="checkoutSummaryCard">
            <div className="checkoutSummaryHead">
              <div>
                <span>YOUR ORDER</span>
                <strong>
                  {cartCount} ITEM{cartCount === 1 ? "" : "S"}
                </strong>
              </div>
              <Link href="/cart">EDIT CART</Link>
            </div>

            <div className="checkoutItems">
              {cart.map((line) => {
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
                <span>Subtotal</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
              <div>
                <span>Shipping</span>
                <strong>
                  {!shippingState
                    ? "Choose state"
                    : !/^\d{5}$/.test(shippingPostcode)
                      ? "Enter postcode"
                      : shippingLoading
                      ? "Calculating..."
                      : shippingQuote
                        ? shippingQuote.shipping_amount === 0
                          ? "FREE"
                          : formatPrice(
                              shippingQuote.shipping_amount
                            )
                        : "Unavailable"}
                </strong>
              </div>
            </div>

            <div className="checkoutSummaryTotal">
              <div>
                <span>TOTAL</span>
                <small>
                  {shippingQuote
                    ? shippingQuote.zone_name
                    : !shippingState
                      ? "Awaiting delivery state"
                      : "Awaiting postcode"}
                </small>
              </div>
              <strong>
                {formatPrice(
                  shippingQuote?.total_amount ?? subtotal
                )}
              </strong>
            </div>

            <div className="checkoutAssurance">
              <span>✓ Secure account checkout</span>
              <span>✓ Order tracking after confirmation</span>
              <span>✓ MIVO customer support</span>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
