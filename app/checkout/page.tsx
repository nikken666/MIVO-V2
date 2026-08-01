"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useMarketplace } from "@/components/MarketplaceProvider";
import { formatPrice } from "@/data/products";

type Buyer = {
  email: string;
  fullName: string;
};

type CheckoutResult = {
  order_number: string;
};

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, clearCart } = useMarketplace();

  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

      setBuyer({
        email: user.email || "",
        fullName:
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : "",
      });
      setLoading(false);
    }

    void checkSession();
  }, [router]);

  const subtotal = cart.reduce((sum, line) => {
    const price = line.variant?.price ?? line.product.price;
    return sum + price * line.quantity;
  }, 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const form = new FormData(event.currentTarget);
      const supabase = createClient();

      const items = cart.map((line) => {
        if (!line.variant?.id) {
          throw new Error(
            `${line.product.name} does not have a valid SKU variation.`
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
      };

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

      clearCart();
      router.push(`/orders/${order.order_number}`);
      router.refresh();
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
          details?.code ? `Error code: ${details.code}` : "",
        ]
          .filter(Boolean)
          .join(" | ") || "Unable to create order."
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="container pageShell">
        <p>Checking your buyer account...</p>
      </main>
    );
  }

  if (!cart.length) {
    return (
      <main className="container pageShell">
        <div className="emptyState">
          <h1>Your cart is empty</h1>
          <Link href="/products" className="redButton inlineButton">
            Browse Products
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container pageShell">
      <div className="pageHeading">
        <div>
          <h1>Checkout</h1>
          <p>Logged in as {buyer?.email}</p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1fr) minmax(300px, 380px)",
          gap: 24,
          alignItems: "start",
        }}
      >
        <form
          onSubmit={submit}
          style={{
            display: "grid",
            gap: 16,
            padding: 24,
            border: "1px solid #e5e5e8",
            borderRadius: 18,
            background: "#fff",
          }}
        >
          <h2 style={{ margin: 0 }}>Shipping Details</h2>

          <label>
            <strong>Full name *</strong>
            <input
              name="full_name"
              required
              defaultValue={buyer?.fullName}
            />
          </label>

          <label>
            <strong>Phone number *</strong>
            <input name="phone" required />
          </label>

          <label>
            <strong>Address line 1 *</strong>
            <input name="address_line_1" required />
          </label>

          <label>
            <strong>Address line 2</strong>
            <input name="address_line_2" />
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            <label>
              <strong>Postcode *</strong>
              <input name="postcode" required />
            </label>

            <label>
              <strong>City *</strong>
              <input name="city" required />
            </label>
          </div>

          <label>
            <strong>State *</strong>
            <select name="state" required defaultValue="">
              <option value="" disabled>Choose state</option>
              <option>Johor</option>
              <option>Kedah</option>
              <option>Kelantan</option>
              <option>Kuala Lumpur</option>
              <option>Labuan</option>
              <option>Melaka</option>
              <option>Negeri Sembilan</option>
              <option>Pahang</option>
              <option>Penang</option>
              <option>Perak</option>
              <option>Perlis</option>
              <option>Putrajaya</option>
              <option>Sabah</option>
              <option>Sarawak</option>
              <option>Selangor</option>
              <option>Terengganu</option>
            </select>
          </label>

          <label>
            <strong>Order note</strong>
            <textarea name="customer_note" rows={3} />
          </label>

          {error && (
            <p style={{ color: "#b40012" }}>{error}</p>
          )}

          <button
            type="submit"
            className="redButton"
            disabled={busy}
          >
            {busy ? "Creating Order..." : "Place Order"}
          </button>
        </form>

        <aside className="orderSummary">
          <h2>Order Summary</h2>

          {cart.map((line) => {
            const price =
              line.variant?.price ?? line.product.price;

            return (
              <div key={line.lineId}>
                <strong>{line.product.name}</strong>
                {line.variant && (
                  <small style={{ display: "block" }}>
                    {line.variant.title} · SKU {line.variant.sku}
                  </small>
                )}
                <span>
                  {line.quantity} × {formatPrice(price)}
                </span>
              </div>
            );
          })}

          <hr />

          <div className="summaryTotal">
            <span>Total</span>
            <strong>{formatPrice(subtotal)}</strong>
          </div>

          <Link href="/cart" className="textButton">
            ← Back to cart
          </Link>
        </aside>
      </div>
    </main>
  );
}
