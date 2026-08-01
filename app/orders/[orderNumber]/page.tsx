"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number | string;
  shipping_address: Record<string, string>;
};

type OrderItem = {
  id: string;
  product_name: string;
  variant_name: string | null;
  sku: string;
  quantity: number;
  line_subtotal: number | string;
};

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderNumber = String(params.orderNumber || "");

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace(
          `/login?next=/orders/${encodeURIComponent(orderNumber)}`
        );
        return;
      }

      const { data: orderData, error: orderError } =
        await supabase
          .from("orders")
          .select(
            "id, order_number, status, payment_status, total_amount, shipping_address"
          )
          .eq("order_number", orderNumber)
          .maybeSingle();

      if (orderError || !orderData) {
        setError(orderError?.message || "Order not found.");
        setLoading(false);
        return;
      }

      const { data: itemData, error: itemError } =
        await supabase
          .from("order_items")
          .select(
            "id, product_name, variant_name, sku, quantity, line_subtotal"
          )
          .eq("order_id", orderData.id)
          .order("created_at");

      if (itemError) {
        setError(itemError.message);
        setLoading(false);
        return;
      }

      setOrder(orderData as OrderRow);
      setItems((itemData as OrderItem[] | null) || []);
      setLoading(false);
    }

    void load();
  }, [orderNumber, router]);

  if (loading) {
    return (
      <main className="container pageShell">
        <p>Loading order...</p>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="container pageShell">
        <div className="emptyState">
          <h1>Unable to open order</h1>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  const address = order.shipping_address || {};

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
        <span style={{ color: "#e60012", fontWeight: 900 }}>
          ORDER CREATED
        </span>

        <h1>{order.order_number}</h1>
        <p>This order is waiting for payment.</p>

        <p>
          Status: <strong>{order.status}</strong>
          <br />
          Payment: <strong>{order.payment_status}</strong>
          <br />
          Total:{" "}
          <strong>{formatPrice(Number(order.total_amount))}</strong>
        </p>

        <h2>Items</h2>

        {items.map((item) => (
          <div
            key={item.id}
            style={{
              padding: 14,
              border: "1px solid #ececef",
              borderRadius: 12,
              marginBottom: 10,
            }}
          >
            <strong>{item.product_name}</strong>
            <small style={{ display: "block" }}>
              {item.variant_name || "Default"} · SKU {item.sku}
            </small>
            <span>
              Quantity {item.quantity} ·{" "}
              {formatPrice(Number(item.line_subtotal))}
            </span>
          </div>
        ))}

        <h2>Shipping address</h2>
        <p>
          {address.full_name}
          <br />
          {address.phone}
          <br />
          {address.address_line_1}
          {address.address_line_2
            ? `, ${address.address_line_2}`
            : ""}
          <br />
          {address.postcode} {address.city}, {address.state}
        </p>

        <button className="redButton" disabled>
          Payment Gateway Coming Next
        </button>

        <div style={{ marginTop: 18 }}>
          <Link href="/products">Continue Shopping</Link>
        </div>
      </section>
    </main>
  );
}
