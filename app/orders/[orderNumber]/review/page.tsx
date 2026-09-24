"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
};

type OrderItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string;
};

type ReviewRow = {
  order_item_id: string;
  rating: number;
  comment: string | null;
};

type ReviewDraft = {
  rating: number;
  comment: string;
};

export default function OrderReviewPage() {
  const params = useParams();
  const router = useRouter();
  const orderNumber = String(params.orderNumber || "");

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace(
            "/login?next=/orders/" +
              encodeURIComponent(orderNumber) +
              "/review"
          );
          return;
        }

        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("id, order_number, status")
          .eq("order_number", orderNumber)
          .eq("user_id", user.id)
          .maybeSingle();

        if (orderError || !orderData) {
          throw orderError || new Error("Order not found.");
        }

        if (orderData.status !== "delivered") {
          router.replace(
            "/orders/" + encodeURIComponent(orderNumber)
          );
          return;
        }

        const { data: itemData, error: itemError } = await supabase
          .from("order_items")
          .select("id, product_id, product_name, variant_name, sku")
          .eq("order_id", orderData.id)
          .order("created_at");

        if (itemError) throw itemError;

        const { data: reviewData, error: reviewError } = await supabase
          .from("product_reviews")
          .select("order_item_id, rating, comment")
          .eq("order_id", orderData.id)
          .eq("user_id", user.id);

        if (reviewError) throw reviewError;

        const saved = new Map(
          ((reviewData as ReviewRow[] | null) || []).map((review) => [
            review.order_item_id,
            review,
          ])
        );

        const nextDrafts: Record<string, ReviewDraft> = {};
        ((itemData as OrderItem[] | null) || []).forEach((item) => {
          const review = saved.get(item.id);
          nextDrafts[item.id] = {
            rating: review?.rating || 0,
            comment: review?.comment || "",
          };
        });

        if (!active) return;

        setOrder(orderData as OrderRow);
        setItems((itemData as OrderItem[] | null) || []);
        setDrafts(nextDrafts);
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load review page."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [orderNumber, router]);

  function setRating(itemId: string, rating: number) {
    setDrafts((current) => ({
      ...current,
      [itemId]: {
        rating,
        comment: current[itemId]?.comment || "",
      },
    }));
  }

  function setComment(itemId: string, comment: string) {
    setDrafts((current) => ({
      ...current,
      [itemId]: {
        rating: current[itemId]?.rating || 0,
        comment,
      },
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!order) return;

    const unrated = items.find(
      (item) => !drafts[item.id] || drafts[item.id].rating < 1
    );

    if (unrated) {
      setError("Please rate every item before submitting.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Your session has expired.");

      const payload = items.map((item) => ({
        user_id: user.id,
        order_id: order.id,
        order_item_id: item.id,
        product_id: item.product_id,
        rating: drafts[item.id].rating,
        comment: drafts[item.id].comment.trim() || null,
        updated_at: new Date().toISOString(),
      }));

      const { error: reviewError } = await supabase
        .from("product_reviews")
        .upsert(payload, { onConflict: "order_item_id" });

      if (reviewError) throw reviewError;

      setMessage("Thank you. Your ratings have been saved.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save your ratings."
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <p className="accountDataNotice">Loading rating form...</p>
        </div>
      </main>
    );
  }

  if (error && !order) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <div className="ordersEmpty">
            <strong>Unable to rate this order.</strong>
            <p>{error}</p>
            <Link href="/orders">BACK TO MY ORDERS →</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="accountDataPage reviewOrderPage">
      <div className="container">
        <div className="accountDataHeader">
          <div>
            <span>MIVO ACCOUNT</span>
            <h1>Rate Your Order</h1>
            <p>
              Order {order?.order_number} · Your feedback helps improve the
              MIVO shopping experience.
            </p>
          </div>

          <Link
            href={"/orders/" + encodeURIComponent(orderNumber)}
          >
            ← ORDER DETAILS
          </Link>
        </div>

        <form className="reviewOrderForm" onSubmit={submit}>
          {items.map((item) => {
            const draft = drafts[item.id] || {
              rating: 0,
              comment: "",
            };

            return (
              <article className="reviewProductCard" key={item.id}>
                <div className="reviewProductHead">
                  <div className="reviewProductImage">M</div>
                  <div>
                    <span>{item.sku}</span>
                    <strong>{item.product_name}</strong>
                    <small>{item.variant_name || "Default"}</small>
                  </div>
                </div>

                <div className="reviewStars">
                  <span>YOUR RATING</span>
                  <div>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        className={
                          star <= draft.rating ? "active" : ""
                        }
                        onClick={() => setRating(item.id, star)}
                        aria-label={star + " star rating"}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <small>
                    {draft.rating === 5
                      ? "Excellent"
                      : draft.rating === 4
                        ? "Good"
                        : draft.rating === 3
                          ? "Okay"
                          : draft.rating === 2
                            ? "Could be better"
                            : draft.rating === 1
                              ? "Poor"
                              : "Tap a star to rate"}
                  </small>
                </div>

                <label className="reviewComment">
                  <span>COMMENTS</span>
                  <textarea
                    rows={4}
                    value={draft.comment}
                    onChange={(event) =>
                      setComment(item.id, event.target.value)
                    }
                    placeholder="Share your experience with this product (optional)"
                  />
                </label>
              </article>
            );
          })}

          {message ? (
            <p className="accountDataSuccess">{message}</p>
          ) : null}
          {error ? <p className="accountDataError">{error}</p> : null}

          <div className="reviewOrderActions">
            <Link href="/orders" className="orderGhostButton">
              BACK TO ORDERS
            </Link>

            <button
              type="submit"
              className="orderPrimaryButton"
              disabled={busy || items.length === 0}
            >
              {busy ? "SAVING..." : "SUBMIT RATING"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
