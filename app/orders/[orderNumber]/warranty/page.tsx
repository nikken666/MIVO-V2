"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type WarrantyOrder = {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  paid_at: string | null;
};

type WarrantyItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  variant_name: string | null;
  warranty_months: number | null;
  image_url?: string | null;
};

function addMonths(value: string, months: number) {
  const date = new Date(value);
  const result = new Date(date);
  const day = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(day, lastDay));
  return result;
}

function dateLabel(value: Date | string | null) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);

  return date.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function OrderWarrantyPage() {
  const params = useParams();
  const router = useRouter();
  const orderNumber = String(params.orderNumber || "");

  const [order, setOrder] = useState<WarrantyOrder | null>(null);
  const [items, setItems] = useState<WarrantyItem[]>([]);
  const [warrantyStart, setWarrantyStart] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace(
            "/login?next=" +
              encodeURIComponent(
                "/orders/" + orderNumber + "/warranty"
              )
          );
          return;
        }

        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("id, order_number, status, created_at, paid_at")
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
          .select(
            "id, product_id, product_name, variant_name, warranty_months"
          )
          .eq("order_id", orderData.id)
          .order("created_at", { ascending: true });

        if (itemError) throw itemError;

        const rawItems =
          (itemData as Omit<WarrantyItem, "image_url">[] | null) || [];
        const warrantiedItems = rawItems.filter(
          (item) => Number(item.warranty_months || 0) > 0
        );

        if (warrantiedItems.length === 0) {
          throw new Error("No warranty is registered for this order.");
        }

        const productIds = Array.from(
          new Set(
            warrantiedItems
              .map((item) => item.product_id)
              .filter((value): value is string => Boolean(value))
          )
        );
        const imageMap = new Map<string, string>();

        if (productIds.length > 0) {
          const { data: products, error: productError } = await supabase
            .from("products")
            .select("id, primary_image_url")
            .in("id", productIds);

          if (productError) throw productError;

          (
            (products as Array<{
              id: string;
              primary_image_url: string | null;
            }> | null) || []
          ).forEach((product) => {
            if (product.primary_image_url) {
              imageMap.set(product.id, product.primary_image_url);
            }
          });

          const missing = productIds.filter(
            (productId) => !imageMap.has(productId)
          );

          if (missing.length > 0) {
            const { data: images, error: imageError } = await supabase
              .from("product_images")
              .select("product_id, image_url, sort_order")
              .in("product_id", missing)
              .order("sort_order", { ascending: true });

            if (imageError) throw imageError;

            (
              (images as Array<{
                product_id: string;
                image_url: string;
                sort_order: number;
              }> | null) || []
            ).forEach((image) => {
              if (!imageMap.has(image.product_id) && image.image_url) {
                imageMap.set(image.product_id, image.image_url);
              }
            });
          }
        }

        const { data: deliveredHistory } = await supabase
          .from("order_status_history")
          .select("created_at")
          .eq("order_id", orderData.id)
          .eq("new_status", "delivered")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!active) return;

        setOrder(orderData as WarrantyOrder);
        setWarrantyStart(
          deliveredHistory?.created_at ||
            orderData.paid_at ||
            orderData.created_at
        );
        setItems(
          warrantiedItems.map((item) => ({
            ...item,
            image_url: item.product_id
              ? imageMap.get(item.product_id) || null
              : null,
          }))
        );
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load warranty."
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

  const activeCount = useMemo(() => {
    if (!warrantyStart) return 0;

    return items.filter((item) => {
      const expiry = addMonths(
        warrantyStart,
        Number(item.warranty_months || 0)
      );
      return expiry.getTime() >= Date.now();
    }).length;
  }, [items, warrantyStart]);

  if (loading) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <p className="accountDataNotice">Loading warranty...</p>
        </div>
      </main>
    );
  }

  if (error || !order || !warrantyStart) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <div className="ordersEmpty">
            <strong>Warranty information unavailable.</strong>
            <p>{error || "No warranty information found."}</p>
            <Link href={"/orders/" + encodeURIComponent(orderNumber)}>
              BACK TO ORDER →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="accountDataPage warrantyPage">
      <div className="container">
        <div className="accountDataHeader">
          <div>
            <span>MIVO WARRANTY</span>
            <h1>Warranty Coverage</h1>
            <p>
              Order {order.order_number} · {activeCount} active coverage
              {activeCount === 1 ? "" : "s"}
            </p>
          </div>

          <Link href={"/orders/" + encodeURIComponent(order.order_number)}>
            ← ORDER DETAILS
          </Link>
        </div>

        <section className="warrantyOverview">
          <div>
            <span>WARRANTY START</span>
            <strong>{dateLabel(warrantyStart)}</strong>
          </div>
          <div>
            <span>ORDER STATUS</span>
            <strong>COMPLETED</strong>
          </div>
          <div>
            <span>COVERED ITEMS</span>
            <strong>{items.length}</strong>
          </div>
        </section>

        <div className="warrantyItemList">
          {items.map((item) => {
            const months = Number(item.warranty_months || 0);
            const expiry = addMonths(warrantyStart, months);
            const active = expiry.getTime() >= Date.now();

            return (
              <article className="warrantyItemCard" key={item.id}>
                <div className="warrantyItemImage">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.product_name} />
                  ) : (
                    <span>M</span>
                  )}
                </div>

                <div className="warrantyItemInfo">
                  <span>{active ? "ACTIVE WARRANTY" : "WARRANTY ENDED"}</span>
                  <strong>{item.product_name}</strong>
                  {item.variant_name ? (
                    <small>{item.variant_name}</small>
                  ) : null}
                </div>

                <div className="warrantyItemPeriod">
                  <div>
                    <span>PERIOD</span>
                    <strong>
                      {months} MONTH{months === 1 ? "" : "S"}
                    </strong>
                  </div>
                  <div>
                    <span>EXPIRES</span>
                    <strong>{dateLabel(expiry)}</strong>
                  </div>
                  <b className={active ? "active" : "expired"}>
                    {active ? "ACTIVE" : "EXPIRED"}
                  </b>
                </div>
              </article>
            );
          })}
        </div>

        <section className="warrantyTermsCard">
          <span>IMPORTANT</span>
          <h2>Warranty record</h2>
          <p>
            Keep your MIVO order record and the product in a condition suitable
            for inspection. Warranty eligibility is subject to the applicable
            product warranty terms and verification of the returned item.
          </p>
        </section>
      </div>
    </main>
  );
}
