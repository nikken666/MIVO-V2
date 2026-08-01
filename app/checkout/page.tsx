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

export default function CheckoutPage() {
  const router = useRouter();
  const { cart } = useMarketplace();

  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(
      "Shipping details saved on this page. Order creation and payment gateway are the next checkout step."
    );
  }

  if (loading) {
    return (
      <main className="container pageShell">
        <section
          style={{
            padding: 28,
            border: "1px solid #e5e5e8",
            borderRadius: 18,
            background: "#fff",
          }}
        >
          Checking your buyer account...
        </section>
      </main>
    );
  }

  if (!cart.length) {
    return (
      <main className="container pageShell">
        <div className="emptyState">
          <span>🛒</span>
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
          gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 380px)",
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

          <label style={{ display: "grid", gap: 7 }}>
            <strong>Full name *</strong>
            <input
              required
              defaultValue={buyer?.fullName}
              placeholder="Full name"
            />
          </label>

          <label style={{ display: "grid", gap: 7 }}>
            <strong>Phone number *</strong>
            <input required placeholder="01X-XXXXXXX" />
          </label>

          <label style={{ display: "grid", gap: 7 }}>
            <strong>Address *</strong>
            <textarea
              required
              rows={4}
              placeholder="House number, street and area"
            />
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            <label style={{ display: "grid", gap: 7 }}>
              <strong>Postcode *</strong>
              <input required placeholder="43000" />
            </label>

            <label style={{ display: "grid", gap: 7 }}>
              <strong>City *</strong>
              <input required placeholder="Kajang" />
            </label>
          </div>

          <label style={{ display: "grid", gap: 7 }}>
            <strong>State *</strong>
            <select required defaultValue="">
              <option value="" disabled>
                Choose state
              </option>
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

          {message && (
            <p
              style={{
                margin: 0,
                padding: 13,
                borderRadius: 10,
                background: "#fff6d8",
              }}
            >
              {message}
            </p>
          )}

          <button type="submit" className="redButton">
            Continue
          </button>
        </form>

        <aside className="orderSummary">
          <h2>Order Summary</h2>

          {cart.map((line) => {
            const price =
              line.variant?.price ?? line.product.price;

            return (
              <div
                key={line.lineId}
                style={{
                  display: "grid",
                  gap: 4,
                  padding: "10px 0",
                  borderBottom: "1px solid #ececef",
                }}
              >
                <strong>{line.product.name}</strong>

                {line.variant && (
                  <small>
                    {line.variant.title} · SKU {line.variant.sku}
                  </small>
                )}

                <span>
                  {line.quantity} × {formatPrice(price)}
                </span>
              </div>
            );
          })}

          <div style={{ marginTop: 14 }}>
            <span>Subtotal</span>
            <strong>{formatPrice(subtotal)}</strong>
          </div>

          <div>
            <span>Shipping</span>
            <strong>Calculated next</strong>
          </div>

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
